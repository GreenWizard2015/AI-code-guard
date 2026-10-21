import { PythonAstData } from "src/core/python_ast_data";
import { PythonAstBridge } from "src/core/python_ast_bridge";
import { PythonCodingLineRules } from "src/linting/orchestration/runtime/python/python_coding_line_rules";
import { MAX_FUNCTION_LINES } from "src/constants";
import { RULE_DATA_BY_ID } from "src/constants";
import { Syntax } from "src/parser/analysis/syntax";
import { TestPathSyntax } from "src/test_path_syntax";
import type { CodingRuleSourceData } from "src/source_types";
import type { DuplicateTypeShapesContract } from "src/analysis_protocols";
import type { PythonAstDataContract, PythonCodingRuleCollectorContract } from "src/python_protocols";
import type { RuleContract, ViolationContract } from "src/reporting_protocols";
import type { TestPathSyntaxContract } from "src/testing_protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { AstCallableNodeContract, AstCodingIssue, NormalizedAstFileContract } from "src/types";
import { DuplicateTypeShapes } from "src/duplicate_type_shapes";
import { RULE_IDS } from "src/constants";

/** Responsibilities: _coding issue collection_, _fixture complexity checks_. **/
export class PythonCodingRuleCollector implements PythonCodingRuleCollectorContract {
	private readonly inline_generic_kind = RULE_IDS.inline_generic_type;
	public readonly ast_parser: PythonAstDataContract;
	private readonly duplicate_type_shapes: DuplicateTypeShapesContract;
	private readonly test_path_syntax: TestPathSyntaxContract;
	private readonly python_test_skips: ReadonlySet<string>;
	private readonly test_only_kinds: ReadonlySet<string>;
	private readonly fixture_names: ReadonlySet<string>;

	/** Responsibilities: _aggregation normalization coding issues_. **/
	private append_coding_issues(violations: ViolationContract[], source: CodingRuleSourceData): void {
		const syntax = new Syntax();
		const coding_line_rules = new PythonCodingLineRules();
		for (const [line, text] of syntax.split_lines(source.text).entries()) {
			for (const kind of coding_line_rules.invalid_line_kinds(text)) {
				if (!RULE_DATA_BY_ID.has(kind)) {
					continue;
				}
				const rule = new DiagnosticRule(kind);
				violations.push(rule.violation(source.file, line + 1, {}));
			}
		}
	}

	/** Responsibilities: _aggregation structural shape violations_. **/
	private append_shapes(violations: ViolationContract[], source: CodingRuleSourceData, ast: NormalizedAstFileContract): void {
		const rule = new DiagnosticRule(RULE_IDS.duplicate_type_shape);
		for (const duplicate of this.duplicate_type_shapes.python(ast.classes)) {
			violations.push(rule.violation(source.file, duplicate.line, { names: duplicate.names.join(", ") }));
		}
	}

	/** Responsibilities: _fixture method diagnostic_. **/
	private append_fixture_method(
		violations: ViolationContract[],
		source: CodingRuleSourceData,
		rule: RuleContract,
		method: AstCallableNodeContract,
	): void {
		if (!this.fixture_names.has(method.name)) {
			return;
		}
		if (method.sloc > MAX_FUNCTION_LINES) {
			violations.push(rule.violation(source.file, method.start + 1, {}));
		}
	}

	/** Responsibilities: _unittest fixture complexity_. **/
	private append_fixture_complexity(violations: ViolationContract[], source: CodingRuleSourceData): void {
		const rule = new DiagnosticRule(RULE_IDS.fixture_complexity);
		const methods = source.normalized_ast.classes.flatMap((node) => node.methods);
		for (const method of methods) {
			this.append_fixture_method(violations, source, rule, method);
		}
	}

	/** Responsibilities: _Python test issue suppression_. **/
	private test_issue_suppressed(
		issue: AstCodingIssue,
		source: CodingRuleSourceData,
		test_path_syntax: TestPathSyntaxContract,
		python_test: boolean,
	): boolean {
		if (issue.kind === "assertion-in-test-function") {
			return true;
		}
		if (this.python_test_skips.has(issue.kind)) {
			return python_test;
		}
		if (issue.kind === RULE_IDS.exception_raising) {
			return !test_path_syntax.test_file_name(source.file);
		}
		if (issue.kind === this.inline_generic_kind) {
			return python_test;
		}
		return false;
	}

	/** Responsibilities: _coding issue suppression_. **/
	private skip_issue(
		issue: AstCodingIssue,
		source: CodingRuleSourceData,
		test_path_syntax: TestPathSyntaxContract,
	): boolean {
		const python_test = test_path_syntax.test_file(source.file, false);
		if (this.test_issue_suppressed(issue, source, test_path_syntax, python_test)) {
			return true;
		}
		if (issue.kind === RULE_IDS.assertion_outside_test) {
			return !python_test;
		}
		return this.test_only_kinds.has(issue.kind) && !python_test;
	}

	/** Responsibilities: _aggregation AST-derived Python rule_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.ast_parser = new PythonAstData(new PythonAstBridge());
		this.duplicate_type_shapes = new DuplicateTypeShapes();
		this.test_path_syntax = new TestPathSyntax();
		this.python_test_skips = new Set([
			RULE_IDS.repeated_literal,
			RULE_IDS.callable_branch_count,
			RULE_IDS.hidden_global_state,
			RULE_IDS.temporal_coupling,
			RULE_IDS.duplicate_error_translation,
			RULE_IDS.retry_without_ownership,
			RULE_IDS.incomplete_cache_key,
		]);
		this.test_only_kinds = new Set([
			RULE_IDS.python_test_assertion,
			RULE_IDS.exception_raising,
			RULE_IDS.python_test_subtest,
			RULE_IDS.test_order_dependency,
		]);
		this.fixture_names = new Set(["setUp", "asyncSetUp", "tearDown", "asyncTearDown", "setUpClass", "tearDownClass"]);
	}
	/** Responsibilities: _public operation_. **/
	public append_ast_issues(
		violations: ViolationContract[],
		source: CodingRuleSourceData,
		issues: AstCodingIssue[],
	): void {
		for (const issue of issues) {
			if (this.skip_issue(issue, source, this.test_path_syntax)) {
				continue;
			}
			if (!RULE_DATA_BY_ID.has(issue.kind)) {
				continue;
			}
			const rule = new DiagnosticRule(issue.kind);
			const parameters: Record<string, string> = {};
			if (issue.kind === RULE_IDS.test_order_dependency) {
				parameters.name = issue.name;
			}
			violations.push(rule.violation(source.file, issue.line + 1, parameters));
		}
	}

	/** Responsibilities: _collection coding AST rule_. **/
	public collect_python_rules(source: CodingRuleSourceData): ViolationContract[] {
		const violations: ViolationContract[] = [];
		const ast = source.normalized_ast;
		if (this.test_path_syntax.test_file(source.file, false)) {
			this.append_fixture_complexity(violations, source);
		}
		this.append_shapes(violations, source, ast);
		let coding_issues = ast.coding_issues;
		if (coding_issues === undefined) {
			coding_issues = [];
		}
		this.append_ast_issues(violations, source, coding_issues);
		if (ast.parse_issues.length > 0) {
			this.append_coding_issues(violations, source);
		}
		return violations;
	}
}
