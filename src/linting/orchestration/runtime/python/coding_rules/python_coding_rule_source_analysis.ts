import type { DuplicateTypeShapesContract } from "src/analysis_protocols";
import {
	MAX_FUNCTION_LINES,
	PYTHON_ONLY_REFLECTIONS,
	PYTHON_REFLECTION_CALLS,
	PYTHON_TYPE_CALL,
	RULE_DATA_BY_ID,
} from "src/constants";
import { RULE_IDS } from "src/linting/constants";
import { PythonCodingLineRules } from "src/linting/orchestration/runtime/python/coding_rules/python_coding_line_rules";
import type { AstCallableNode, AstCodingIssue, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { Syntax } from "src/parser/analysis/syntax";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { TestPathSyntaxContract } from "src/shared_services_protocols";
import type { CodingRuleSourceData } from "src/source_types";
import { TestPathKind } from "src/types";

/** Responsibilities: _Python source analysis_, _test issue classification_. **/
export class PythonCodingRuleSourceAnalysis {
	private readonly _source: CodingRuleSourceData;
	private readonly _duplicate_type_shapes: DuplicateTypeShapesContract;
	private readonly _test_path_syntax: TestPathSyntaxContract;
	private readonly _python_test_skips: ReadonlySet<string>;
	private readonly _test_only_kinds: ReadonlySet<string>;
	private readonly _fixture_names: ReadonlySet<string>;
	private readonly _stage_timer: LintStageTimerContract;

	/** Responsibilities: _AST coding issue materialization_. **/
	private append_ast_issue(violations: ViolationContract[], ast_issue: AstCodingIssue): void {
		if (this.skip_issue(ast_issue)) {
			return;
		}
		if (!RULE_DATA_BY_ID.has(ast_issue.kind)) {
			return;
		}
		const rule = new DiagnosticRule(ast_issue.kind);
		const parameters = this.issue_parameters(ast_issue);
		violations.push(rule.violation(this._source.file, ast_issue.line + 1, parameters));
	}

	/** Responsibilities: _fixture method diagnostics_. **/
	private fixture_method_issue(rule: RuleContract, method: AstCallableNode): ViolationContract[] {
		if (!this._fixture_names.has(method.identity.name)) {
			return [];
		}
		if (method.metrics.sloc <= MAX_FUNCTION_LINES) {
			return [];
		}
		return [rule.violation(this._source.file, method.identity.start + 1, {})];
	}

	/** Responsibilities: _Python test issue suppression_. **/
	private test_issue_suppressed(issue: AstCodingIssue, python_test: boolean): boolean {
		if (issue.kind === "assertion-in-test-function") {
			return true;
		}
		if (this._python_test_skips.has(issue.kind)) {
			return python_test;
		}
		if (issue.kind === RULE_IDS.exception_raising) {
			const source_path = this._test_path_syntax.classify(this._source.file);
			return !source_path.has(TestPathKind.TestFileName);
		}
		if (issue.kind === RULE_IDS.inline_generic_type) {
			return python_test;
		}
		return false;
	}

	/** Responsibilities: _diagnostic parameter creation_. **/
	private issue_parameters(candidate_issue: AstCodingIssue): Record<string, string> {
		const parameters: Record<string, string> = {};
		if (candidate_issue.kind === RULE_IDS.test_order_dependency) {
			const name_key = "name";
			parameters[name_key] = candidate_issue.name;
		}
		return parameters;
	}

	/** Responsibilities: _Python source analysis initialization_. **/
	public constructor(
		source: CodingRuleSourceData,
		duplicate_type_shapes: DuplicateTypeShapesContract,
		test_path_syntax: TestPathSyntaxContract,
		stage_timer: LintStageTimerContract,
	) {
		this._source = source;
		this._duplicate_type_shapes = duplicate_type_shapes;
		this._test_path_syntax = test_path_syntax;
		this._stage_timer = stage_timer;
		this._python_test_skips = new Set([
			RULE_IDS.repeated_literal,
			RULE_IDS.callable_branch_count,
			RULE_IDS.hidden_global_state,
			RULE_IDS.temporal_coupling,
			RULE_IDS.duplicate_error_translation,
			RULE_IDS.retry_without_ownership,
		]);
		this._test_only_kinds = new Set([
			RULE_IDS.python_test_assertion,
			RULE_IDS.exception_raising,
			RULE_IDS.python_test_subtest,
			RULE_IDS.test_order_dependency,
		]);
		this._fixture_names = new Set(["setUp", "asyncSetUp", "tearDown", "asyncTearDown", "setUpClass", "tearDownClass"]);
	}

	/** Responsibilities: _Python source line diagnostics_. **/
	public coding_issues(): ViolationContract[] {
		const violations: ViolationContract[] = [];
		const syntax = new Syntax();
		const coding_line_rules = new PythonCodingLineRules(
			PYTHON_REFLECTION_CALLS,
			PYTHON_ONLY_REFLECTIONS,
			PYTHON_TYPE_CALL,
			this._stage_timer,
		);
		for (const [line, text] of syntax.split_lines(this._source.text).entries()) {
			for (const kind of coding_line_rules.invalid_line_kinds(text)) {
				if (!RULE_DATA_BY_ID.has(kind)) {
					continue;
				}
				const rule = new DiagnosticRule(kind);
				violations.push(rule.violation(this._source.file, line + 1, {}));
			}
		}
		return violations;
	}

	/** Responsibilities: _duplicate type shape diagnostics_. **/
	public shape_issues(ast: NormalizedAstFile): ViolationContract[] {
		const violations: ViolationContract[] = [];
		const rule = new DiagnosticRule(RULE_IDS.duplicate_type_shape);
		for (const duplicate of this._duplicate_type_shapes.python(ast.source.classes)) {
			violations.push(rule.violation(this._source.file, duplicate.line, { names: duplicate.names.join(", ") }));
		}
		return violations;
	}

	/** Responsibilities: _AST coding issue diagnostics_. **/
	public ast_issues(issues: readonly AstCodingIssue[]): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const coding_issue of issues) {
			this._stage_timer.measure(`rule.${coding_issue.kind}.python.postprocess`, () =>
				this.append_ast_issue(violations, coding_issue),
			);
		}
		return violations;
	}

	/** Responsibilities: _test fixture complexity diagnostics_. **/
	public fixture_complexity_issues(): ViolationContract[] {
		return this._stage_timer.measure(`rule.${RULE_IDS.fixture_complexity}.python`, () => {
			const violations: ViolationContract[] = [];
			const rule = new DiagnosticRule(RULE_IDS.fixture_complexity);
			const ast = this._source.normalized_ast;
			const methods = ast.source.classes.flatMap((node) => node.structure.methods);
			for (const method of methods) {
				violations.push(...this.fixture_method_issue(rule, method));
			}
			return violations;
		});
	}

	/** Responsibilities: _per-file Python rules_. **/
	public python_issues(is_test_file: boolean): ViolationContract[] {
		const ast = this._source.normalized_ast;
		const fixtures: ViolationContract[] = [];
		if (is_test_file) {
			fixtures.push(...this.fixture_complexity_issues());
		}
		const shapes = this.shape_issues(ast);
		let coding_issues: readonly AstCodingIssue[] = [];
		if (ast.source.coding_issues !== undefined) {
			coding_issues = ast.source.coding_issues;
		}
		const syntax = this.ast_issues(coding_issues);
		const parsed: ViolationContract[] = [];
		if (ast.source.parse_issues.length > 0) {
			parsed.push(...this.coding_issues());
		}
		return [...fixtures, ...shapes, ...syntax, ...parsed];
	}

	/** Responsibilities: _test path issue filtering_. **/
	public skip_issue(issue: AstCodingIssue): boolean {
		const python_test = this._test_path_syntax.classify(this._source.file).has(TestPathKind.TestFile);
		if (this.test_issue_suppressed(issue, python_test)) {
			return true;
		}
		if (issue.kind === RULE_IDS.assertion_outside_test) {
			return !python_test;
		}
		return this._test_only_kinds.has(issue.kind) && !python_test;
	}
}
