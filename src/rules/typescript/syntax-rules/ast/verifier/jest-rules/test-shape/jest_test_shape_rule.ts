import { METRIC_KIND_FUNCTION } from "src/metrics/constants";
import type { JestCallbackKind } from "src/model/ast/normalized_ast_types";
import type { JestTestShapeRuleContract } from "src/testing_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _callback type validation_, _assertion presence detection_. **/
export class JestTestShapeRule implements JestTestShapeRuleContract {
	private readonly _expect_aliases: TypeScriptExpressionAliasesContract;
	private readonly _source_file: ts.SourceFile;

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
				if (this._expect_aliases.receiver({ expression: callee, node: current })) {
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
	private line(node: ts.CallExpression): number {
		const position = node.getStart(this._source_file);
		const character = this._source_file.getLineAndCharacterOfPosition(position);
		return character.line + 1;
	}

	/** Responsibilities: _classification callback shape passed_. **/
	private callback_kind(node: ts.CallExpression): JestCallbackKind {
		const candidate = node.arguments[1];
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

	/** Responsibilities: _collection lines Jest tests_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor(source_file: ts.SourceFile, expect_aliases: TypeScriptExpressionAliasesContract) {
		this._source_file = source_file;
		this._expect_aliases = expect_aliases;
	}
	/** Responsibilities: _public operation_. **/
	public non_arrow_lines(tests: ts.CallExpression[]): number[] {
		const lines: number[] = [];
		for (const test of tests) {
			if (this.callback_kind(test) !== "arrow") {
				lines.push(this.line(test));
			}
		}
		return lines;
	}

	/** Responsibilities: _collection lines Jest tests_. **/
	public missing_expect_lines(tests: ts.CallExpression[]): number[] {
		const lines: number[] = [];
		for (const test of tests) {
			const callback = test.arguments[1];
			if (callback === undefined || !ts.isArrowFunction(callback)) {
				continue;
			}
			if (!this.contains_direct_expect(callback)) {
				lines.push(this.line(test));
			}
		}
		return lines;
	}
}
