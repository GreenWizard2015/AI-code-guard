import ts from "typescript";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/typescript-expression-aliases";

/** Responsibilities: _inspection Jest test callbacks_. **/
export class JestTestEndingRule {
	private readonly expect_aliases = new TypeScriptExpressionAliases("expect");

	/** Responsibilities: _classification expression directly invokes_. **/
	private expect_expression(expression: ts.Expression, node: ts.Node): boolean {
		const current = this.expect_aliases.unwrapped(expression);
		if (ts.isAwaitExpression(current)) {
			return this.expect_expression(current.expression, node);
		}
		if (ts.isCallExpression(current)) {
			const callee = this.expect_aliases.unwrapped(current.expression);
			if (ts.isIdentifier(callee)) {
				if (this.expect_aliases.receiver(callee, node)) {
					return true;
				}
			}
			return this.expect_expression(callee, node);
		}
		if (ts.isPropertyAccessExpression(current)) {
			return this.expect_expression(current.expression, node);
		}
		return false;
	}

	/** Responsibilities: _collection expect invocation test_. **/
	private expect_calls(body: ts.Block): ts.CallExpression[] {
		const calls: ts.CallExpression[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isCallExpression(node)) {
				const callee = this.expect_aliases.unwrapped(node.expression);
				if (ts.isIdentifier(callee)) {
					if (this.expect_aliases.receiver(callee, node)) {
						calls.push(node);
					}
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(body);
		return calls;
	}

	/** Responsibilities: _classification expect invocation direct_. **/
	private is_direct_expect(call: ts.CallExpression, body: ts.Block): boolean {
		let current: ts.Node = call;
		while (current.parent !== undefined && current.parent !== body) {
			current = current.parent;
		}
		return ts.isExpressionStatement(current) && this.expect_expression(current.expression, current);
	}

	/** Responsibilities: _classification test body ends_. **/
	private has_valid_ending(body: ts.Block): boolean {
		if (this.expect_calls(body).some((call) => !this.is_direct_expect(call, body))) {
			return false;
		}
		let found_expect = false;
		for (const statement of body.statements) {
			if (!found_expect) {
				if (ts.isExpressionStatement(statement) && this.expect_expression(statement.expression, statement)) {
					found_expect = true;
				}
				continue;
			}
			if (!ts.isExpressionStatement(statement) || !this.expect_expression(statement.expression, statement)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _valid Jest callback classification_. **/
	private is_valid_callback(callback: ts.FunctionLikeDeclaration): boolean {
		if (callback.body === undefined) {
			return true;
		}
		if (!ts.isBlock(callback.body)) {
			return true;
		}
		return this.has_valid_ending(callback.body);
	}

	/** Responsibilities: _classification Jest invocation usage_. **/
	private has_invalid_callback(node: ts.CallExpression): boolean {
		const candidate = node.arguments[node.arguments.length - 1];
		if (candidate === undefined || (!ts.isArrowFunction(candidate) && !ts.isFunctionExpression(candidate))) {
			return false;
		}
		return !this.is_valid_callback(candidate);
	}

	/** Responsibilities: _collection lines Jest tests_. **/
	public invalid_test_lines(source_file: ts.SourceFile, tests: ts.CallExpression[]): number[] {
		const lines: number[] = [];
		for (const test of tests) {
			if (this.has_invalid_callback(test)) {
				lines.push(source_file.getLineAndCharacterOfPosition(test.getStart(source_file)).line + 1);
			}
		}
		return lines;
	}

	/** Responsibilities: _Jest test invocation count_. **/
	public test_count(tests: ts.CallExpression[]): number {
		return tests.length;
	}
}
