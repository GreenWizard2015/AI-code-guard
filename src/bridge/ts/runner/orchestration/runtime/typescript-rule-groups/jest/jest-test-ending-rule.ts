import ts from 'typescript';

/** Responsibilities: _inspection Jest test callbacks_. **/
export class JestTestEndingRule {
	private readonly expect_name = 'expect';

	/** Responsibilities: _classification expression directly invokes_. **/
	private expect_expression(expression: ts.Expression): boolean {
		if (ts.isAwaitExpression(expression)) {
			return this.expect_expression(expression.expression);
		}
		if (ts.isCallExpression(expression)) {
if (ts.isIdentifier(expression.expression) && expression.expression.text === this.expect_name) {
				return true;
			}
			return this.expect_expression(expression.expression);
		}
		if (ts.isPropertyAccessExpression(expression)) {
			return this.expect_expression(expression.expression);
		}
		return false;
	}

	/** Responsibilities: _collection expect invocation test_. **/
	private expect_calls(body: ts.Block): ts.CallExpression[] {
		const calls: ts.CallExpression[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isCallExpression(node)) {
				let is_expect_call = false;
				if (ts.isIdentifier(node.expression)) {
					is_expect_call = node.expression.text === this.expect_name;
				}
				if (is_expect_call) {
					calls.push(node);
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
		return ts.isExpressionStatement(current) && this.expect_expression(current.expression);
	}

	/** Responsibilities: _classification test body ends_. **/
	private has_valid_ending(body: ts.Block): boolean {
		if (this.expect_calls(body).some(call => !this.is_direct_expect(call, body))) {
			return false;
		}
		let found_expect = false;
		for (const statement of body.statements) {
			if (!found_expect) {
if (ts.isExpressionStatement(statement) && this.expect_expression(statement.expression)) {
					found_expect = true;
				}
				continue;
			}
if (!ts.isExpressionStatement(statement) || !this.expect_expression(statement.expression)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _valid Jest callback classification_. **/
	private is_valid_callback(callback: ts.FunctionLikeDeclaration): boolean {
		if (callback.body === undefined || !ts.isBlock(callback.body)) {
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
