import ts from "typescript";
import type { JestCallbackKind } from "src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/types";
import { JestAssertionShapeRule } from "src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/jest-assertion-shape-rule";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/typescript-expression-aliases";

/** Responsibilities: _classification Jest callbacks expectations_. **/
export class JestTestShapeRule {
	private readonly assertion_shape_rule = new JestAssertionShapeRule();
	private readonly expect_aliases = new TypeScriptExpressionAliases("expect");

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
		if (body === undefined || !ts.isBlock(body)) {
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
		if (candidate !== undefined && ts.isArrowFunction(candidate)) {
			return "arrow";
		}
		if (candidate !== undefined && ts.isFunctionExpression(candidate)) {
			return "function";
		}
		return "other";
	}

	/** Responsibilities: _classification test callback lacks_. **/
	private is_missing_expect(node: ts.CallExpression): boolean {
		const candidate = node.arguments[node.arguments.length - 1];
		if (this.callback_kind(node) !== "arrow") {
			return false;
		}
		if (candidate === undefined || !ts.isArrowFunction(candidate)) {
			return false;
		}
		return !this.contains_direct_expect(candidate);
	}

	/** Responsibilities: _try-catch detection_. **/
	private contains_try_catch(body: ts.Block): boolean {
		let found = false;
		const visit = (child: ts.Node): void => {
			if (found) {
				return;
			}
			if (ts.isTryStatement(child) && child.catchClause !== undefined) {
				found = true;
				return;
			}
			ts.forEachChild(child, visit);
		};
		visit(body);
		return found;
	}

	/** Responsibilities: _classification test callback contains_. **/
	private has_try_catch(node: ts.CallExpression): boolean {
		const callback = node.arguments[node.arguments.length - 1];
		if (callback === undefined) {
			return false;
		}
		if (!ts.isArrowFunction(callback)) {
			return false;
		}
		if (!ts.isBlock(callback.body)) {
			return false;
		}
		return this.contains_try_catch(callback.body);
	}

	/** Responsibilities: _collection lines Jest tests_. **/
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

	/** Responsibilities: _collection lines Jest tests_. **/
	public shape_test_lines(source_file: ts.SourceFile, tests: ts.CallExpression[]): number[] {
		const lines: number[] = [];
		for (const test of tests) {
			const assertions = this.assertion_shape_rule.collect_assertions(test);
			if (this.assertion_shape_rule.shape_only(assertions)) {
				lines.push(this.line(source_file, test));
			}
		}
		return lines;
	}

	/** Responsibilities: _collection lines Jest tests_. **/
	public exception_test_lines(source_file: ts.SourceFile, tests: ts.CallExpression[]): number[] {
		const lines: number[] = [];
		for (const test of tests) {
			const assertions = this.assertion_shape_rule.collect_assertions(test);
			if (this.assertion_shape_rule.exception_only(assertions)) {
				lines.push(this.line(source_file, test));
				continue;
			}
			if (this.has_try_catch(test)) {
				lines.push(this.line(source_file, test));
			}
		}
		return lines;
	}
}
