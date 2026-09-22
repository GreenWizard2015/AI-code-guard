import { PythonAstData } from 'src/bridge/ts/core/python-ast-parser';
import { PythonCodingLineRules } from 'src/bridge/ts/runner/orchestration/runtime/python/python-coding-line-rules';
import { Syntax } from 'src/syntax';
import { TestPathSyntax } from 'src/test-path-syntax';
import type { Violation } from 'src/protocols';
import { RULES_BY_ID } from 'src/model/constants';
import type { CodingRuleSource } from 'src/coding-rule-source';
import type { AstCodingIssue, NormalizedAstFile } from 'src/types';
import { DuplicateTypeShapes } from 'src/duplicate-type-shapes';

/** Responsibilities: _collection Python coding issues_. **/
export class PythonCodingRuleCollector {
	private readonly inline_generic_kind = 'inline-generic-type';
	public readonly ast_parser = new PythonAstData();
	private readonly duplicate_type_shapes = new DuplicateTypeShapes();

	/** Responsibilities: _aggregation normalization coding issues_. **/
	private append_coding_issues(violations: Violation[], source: CodingRuleSource): void {
		const syntax = new Syntax();
		const coding_line_rules = new PythonCodingLineRules();
		for (const [line, text] of syntax.split_lines(source.text).entries()) {
			for (const kind of coding_line_rules.invalid_line_kinds(text)) {
				const rule = RULES_BY_ID.get(kind);
				if (rule) {
					violations.push(rule.violation(source.file, line + 1, {}));
				}
			}
		}
	}

	/** Responsibilities: _aggregation structural shape violations_. **/
	private append_shapes(
		violations: Violation[],
		source: CodingRuleSource,
		ast: NormalizedAstFile
	): void {
		const rule = RULES_BY_ID.get('duplicate-type-shape');
		if (rule === undefined) {
			return;
		}
		for (const duplicate of this.duplicate_type_shapes.python(ast.classes)) {
			violations.push(rule.violation(source.file, duplicate.line, { names: duplicate.names.join(', ') }));
		}
	}

	/** Responsibilities: _classification coding issue suppressed_. **/
	private skip_issue(
		issue: AstCodingIssue,
		source: CodingRuleSource,
		test_path_syntax: TestPathSyntax
	): boolean {
		if (issue.kind === 'assertion-outside-test') {
			return !test_path_syntax.test_py(source.file);
		}
		if (issue.kind === 'assertion-in-test-function') {
			return true;
		}
if (issue.kind === this.inline_generic_kind && test_path_syntax.test_file(source.file)) {
			return true;
		}
		const test_only_kinds = ['python-test-assert-statement', 'exception-raising', 'python-test-subtest'];
return test_only_kinds.includes(issue.kind) && !test_path_syntax.test_py(source.file);
	}

	/** Responsibilities: _aggregation AST-derived Python rule_. **/
	public append_ast_issues(
		violations: Violation[],
		source: CodingRuleSource,
		issues: AstCodingIssue[]
	): void {
		const test_path_syntax = new TestPathSyntax();
		for (const issue of issues) {
			if (this.skip_issue(issue, source, test_path_syntax)) {
				continue;
			}
			const rule = RULES_BY_ID.get(issue.kind);
			if (rule) {
				violations.push(rule.violation(source.file, issue.line + 1, {}));
			}
		}
	}

	/** Responsibilities: _collection coding AST rule_. **/
	public collect_python_rules(source: CodingRuleSource): Violation[] {
		const violations: Violation[] = [];
		const ast = source.normalized_python_ast;
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
