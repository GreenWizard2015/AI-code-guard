import type { JestCallbackKind } from "src/types";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";
import ts from "typescript";
import type { JestTestShapeRuleContract } from "src/protocols";
import { METRIC_KIND_FUNCTION } from "src/metrics/constants";

/** Responsibilities: _callback type validation_, _assertion presence detection_. **/
export class JestTestShapeRule implements JestTestShapeRuleContract {
	private readonly expect_aliases: TypeScriptExpressionAliases;

	/** Responsibilities: _unwrapping Jest assertion expression_. **/
	private unwrapped_expression(expression: ts.Expression): ts.Expression {
		let current = expression;
		while (true) {
			if (ts.isParenthesizedExpression(current) || ts.isNonNullExpression(current)) {
				current = current.expression;
				continue;
			}
			if (ts.isAsExpression(current) || ts.isTypeAssertionExpression(current)) {
				current = current.expression;
				continue;
			}
			if (ts.isSatisfiesExpression(current)) {
				current = current.expression;
				continue;
			}
			return current;
		}
	}

	/** Responsibilities: _classification expression directly invokes_. **/
	private expect_expression(expression: ts.Expression, node: ts.Node): boolean {
		const current = this.unwrapped_expression(expression);
		if (ts.isAwaitExpression(current)) {
			return this.expect_expression(current.expression, node);
		}
		if (ts.isCallExpression(current)) {
			const callee = this.unwrapped_expression(current.expression);
			if (ts.isIdentifier(callee)) {
				if (this.expect_aliases.receiver(callee, current)) {
					return true;
				}
			}
			return this.expect_expression(current.expression, node);
		}
		if (ts.isPropertyAccessExpression(current)) {
			return this.expect_expression(current.expression, node);
		}
		return false;
	}

	/** Responsibilities: _detection direct expect invocation_. **/
	private contains_direct_expect(callback: ts.FunctionLikeDeclaration): boolean {
		const body = callback.body;
		if (body === undefined) {
			return false;
		}
		if (!ts.isBlock(body)) {
			return false;
		}
		return body.statements.some(
			(statement) =>
				ts.isExpressionStatement(statement) && this.expect_expression(statement.expression, statement.expression),
		);
	}

	/** Responsibilities: _Jest invocation position conversion_. **/
	private line(source_file: ts.SourceFile, node: ts.CallExpression): number {
		const position = node.getStart(source_file);
		const character = source_file.getLineAndCharacterOfPosition(position);
		return character.line + 1;
	}

	/** Responsibilities: _classification callback shape passed_. **/
	private callback_kind(node: ts.CallExpression): JestCallbackKind {
		const candidate = node.arguments[node.arguments.length - 1];
		if (candidate !== undefined) {
			if (ts.isArrowFunction(candidate)) {
				return "arrow";
			}
			if (ts.isFunctionExpression(candidate)) {
				return METRIC_KIND_FUNCTION;
			}
		}
		return "other";
	}

	/** Responsibilities: _classification test callback lacks_. **/
	private is_missing_expect(node: ts.CallExpression): boolean {
		const candidate = node.arguments[node.arguments.length - 1];
		if (this.callback_kind(node) !== "arrow") {
			return false;
		}
		if (candidate === undefined) {
			return false;
		}
		if (!ts.isArrowFunction(candidate)) {
			return false;
		}
		return !this.contains_direct_expect(candidate);
	}

	/** Responsibilities: _collection lines Jest tests_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.expect_aliases = new TypeScriptExpressionAliases("expect");
	}
	/** Responsibilities: _public operation_. **/
	public non_arrow_lines(source_file: ts.SourceFile, tests: ts.CallExpression[]): number[] {
		const lines: number[] = [];
		for (const test of tests) {
			if (this.callback_kind(test) !== "arrow") {
				lines.push(this.line(source_file, test));
			}
		}
		return lines;
	}

	/** Responsibilities: _collection lines Jest tests_. **/
	public missing_expect_lines(source_file: ts.SourceFile, tests: ts.CallExpression[]): number[] {
		const lines: number[] = [];
		for (const test of tests) {
			if (this.is_missing_expect(test)) {
				lines.push(this.line(source_file, test));
			}
		}
		return lines;
	}
}
