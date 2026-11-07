import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _direct assertion recognition_, _callback ending validation_. **/
export class JestTestEndingRule {
	private readonly _expect_aliases: TypeScriptExpressionAliasesContract;

	/** Responsibilities: _classification expression directly invokes_. **/
	private expect_expression(expression: ts.Expression, node: ts.Node): boolean {
		const current = this._expect_aliases.unwrapped(expression);
		if (ts.isAwaitExpression(current)) {
			return this.expect_expression(current.expression, node);
		}
		if (ts.isCallExpression(current)) {
			const callee = this._expect_aliases.unwrapped(current.expression);
			if (ts.isIdentifier(callee)) {
				if (this._expect_aliases.receiver({ expression: callee, node: node })) {
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
	private expect_calls(callback: ts.FunctionLikeDeclaration): ts.CallExpression[] {
		const calls: ts.CallExpression[] = [];
		const body = callback.body;
		if (body === undefined || !ts.isBlock(body)) {
			return calls;
		}
		const visit = (node: ts.Node): void => {
			if (ts.isCallExpression(node)) {
				const callee = this._expect_aliases.unwrapped(node.expression);
				if (ts.isIdentifier(callee)) {
					if (this._expect_aliases.receiver({ expression: callee, node: node })) {
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

	/** Responsibilities: _consecutive assertion statements_. **/
	private assertion_tail(statements: ts.NodeArray<ts.Statement>): boolean {
		let found_expect = false;
		for (const statement of statements) {
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

	/** Responsibilities: _classification test body ends_. **/
	private has_valid_ending(callback: ts.FunctionLikeDeclaration): boolean {
		const body = callback.body;
		if (body === undefined || !ts.isBlock(body)) {
			return true;
		}
		if (this.expect_calls(callback).some((call) => !this.is_direct_expect(call, body))) {
			return false;
		}
		return this.assertion_tail(body.statements);
	}

	/** Responsibilities: _classification Jest invocation usage_. **/
	private has_invalid_callback(node: ts.CallExpression): boolean {
		const candidate = node.arguments[1];
		if (candidate === undefined || (!ts.isArrowFunction(candidate) && !ts.isFunctionExpression(candidate))) {
			return false;
		}
		return this.has_valid_ending(candidate) === false;
	}

	/** Responsibilities: _collection lines Jest tests_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor(expect_aliases: TypeScriptExpressionAliasesContract) {
		this._expect_aliases = expect_aliases;
	}
	/** Responsibilities: _public operation_. **/
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
