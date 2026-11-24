import { JEST_ANY, JEST_INSTANCE } from "src/constants";
import { CONSTRUCTOR_NAME } from "src/metrics/constants";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { DiagnosticRuleContract } from "src/model/protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { JestSuiteCollectorContract } from "src/testing_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _Jest matcher recognition_, _runtime type expression analysis_, _diagnostic construction_. **/
export class JestTestTypeChecks {
	private readonly _file: string;
	private readonly _source_file: ts.SourceFile;
	private readonly _suite_collector: JestSuiteCollectorContract;
	private readonly _expect_aliases: TypeScriptExpressionAliasesContract;
	private readonly _rule: DiagnosticRuleContract;

	/** Responsibilities: _Jest expectation receiver_. **/
	private is_expectation(expression: ts.Expression, call_site: ts.Node): boolean {
		if (!ts.isCallExpression(expression) || !ts.isIdentifier(expression.expression)) {
			return false;
		}
		return this._expect_aliases.receiver({ expression: expression.expression, node: call_site });
	}

	/** Responsibilities: _Jest type matcher_. **/
	private jest_type_matcher(call: ts.CallExpression, matcher: string): boolean {
		const member = call.expression;
		if (!ts.isPropertyAccessExpression(member) && !ts.isElementAccessExpression(member)) {
			return false;
		}
		if (this._expect_aliases.member_name({ expression: member }) !== matcher) {
			return false;
		}
		if (matcher === JEST_INSTANCE) {
			return this.is_expectation(member.expression, call);
		}
		if (!ts.isIdentifier(member.expression)) {
			return false;
		}
		return this._expect_aliases.receiver({ expression: member.expression, node: call });
	}

	/** Responsibilities: _array type probe_. **/
	private is_array_check(call: ts.CallExpression): boolean {
		if (!ts.isPropertyAccessExpression(call.expression)) {
			return false;
		}
		const property = call.expression;
		if (property.name.text !== "isArray") {
			return false;
		}
		if (!ts.isIdentifier(property.expression)) {
			return false;
		}
		return property.expression.text === "Array";
	}

	/** Responsibilities: _runtime type expression_. **/
	private is_type_expression(expression_node: ts.Node): boolean {
		if (ts.isTypeOfExpression(expression_node)) {
			return true;
		}
		if (ts.isBinaryExpression(expression_node)) {
			return expression_node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword;
		}
		if (ts.isPropertyAccessExpression(expression_node)) {
			return expression_node.name.text === CONSTRUCTOR_NAME;
		}
		return false;
	}

	/** Responsibilities: _runtime type check traversal_. **/
	private visit(traversal_node: ts.Node, lines: Set<number>): void {
		if (this.type_check(traversal_node)) {
			const line = this._source_file.getLineAndCharacterOfPosition(traversal_node.getStart(this._source_file)).line + 1;
			lines.add(line);
		}
		ts.forEachChild(traversal_node, (child) => this.visit(child, lines));
	}

	/** Responsibilities: _diagnostic construction_. **/
	private violations(lines: readonly number[]): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const line of lines) {
			violations.push(this._rule.violation(this._file, line, {}));
		}
		return violations;
	}

	/** Responsibilities: _rule initialization_. **/
	public constructor(
		file: string,
		source_file: ts.SourceFile,
		suite_collector: JestSuiteCollectorContract,
		expect_aliases: TypeScriptExpressionAliasesContract,
	) {
		this._file = file;
		this._source_file = source_file;
		this._suite_collector = suite_collector;
		this._expect_aliases = expect_aliases;
		this._rule = new DiagnosticRule("test-type-check");
	}

	/** Responsibilities: _runtime type check classification_. **/
	public type_check(candidate: ts.Node): boolean {
		if (this.is_type_expression(candidate)) {
			return true;
		}
		if (!ts.isCallExpression(candidate)) {
			return false;
		}
		if (this.is_array_check(candidate)) {
			return true;
		}
		if (this.jest_type_matcher(candidate, JEST_INSTANCE)) {
			return true;
		}
		return this.jest_type_matcher(candidate, JEST_ANY);
	}

	/** Responsibilities: _Jest matcher recognition_, _runtime type expression analysis_. **/
	public append(test: ts.CallExpression): ViolationContract[] {
		const lines = new Set<number>();
		this._suite_collector.with_callback(test, (callback) => {
			if (callback.body === undefined) {
				return;
			}
			this.visit(callback.body, lines);
		});
		const sorted_lines = [...lines];
		sorted_lines.sort((left, right) => left - right);
		return this.violations(sorted_lines);
	}
}
