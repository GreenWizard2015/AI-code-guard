import ts from "typescript";
import type { CallableConsumer } from "src/protocols";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/typescript-expression-aliases";

import type { JestSuite } from "src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/types";

/** Responsibilities: _discovery Jest suites tests_. **/
export class JestSuiteCollector {
	private readonly test_names = new Set(["test", "it"]);
	private readonly modifier_names = new Set(["only", "skip", "concurrent", "fails", "todo", "each"]);
	private readonly describe_name = "describe";
	private readonly describe_aliases = new TypeScriptExpressionAliases("describe");
	private readonly test_aliases = new TypeScriptExpressionAliases("test");
	private readonly it_aliases = new TypeScriptExpressionAliases("it");

	/** Responsibilities: _unwrapping Jest invocation expression_. **/
	private unwrapped_expression(expression: ts.Expression): ts.Expression {
		let current = expression;
		while (true) {
			if (ts.isParenthesizedExpression(current)) {
				current = current.expression;
				continue;
			}
			if (ts.isAsExpression(current) || ts.isTypeAssertionExpression(current)) {
				current = current.expression;
				continue;
			}
			return current;
		}
	}

	/** Responsibilities: _Jest identifier names_. **/
	private identifier_call_name(expression: ts.Identifier, node: ts.Node): string {
		if (this.describe_aliases.receiver(expression, node)) {
			return this.describe_name;
		}
		if (this.test_aliases.receiver(expression, node)) {
			return "test";
		}
		if (this.it_aliases.receiver(expression, node)) {
			return "it";
		}
		return expression.text;
	}

	/** Responsibilities: _Jest property names_. **/
	private property_call_name(expression: ts.PropertyAccessExpression, node: ts.Node): string {
		if (!this.modifier_names.has(expression.name.text)) {
			return "";
		}
		const owner = this.unwrapped_expression(expression.expression);
		return this.call_name(owner, node);
	}

	/** Responsibilities: _resolution Jest invocation expression_. **/
	private call_name(expression: ts.Expression, node: ts.Node): string {
		const current = this.unwrapped_expression(expression);
		if (ts.isIdentifier(current)) {
			return this.identifier_call_name(current, node);
		}
		if (ts.isPropertyAccessExpression(current)) {
			return this.property_call_name(current, node);
		}
		return "";
	}

	/** Responsibilities: _classification invocation usage Jest_. **/
	private is_each_factory(node: ts.CallExpression): boolean {
		const expression = this.unwrapped_expression(node.expression);
		if (!ts.isPropertyAccessExpression(expression)) {
			return false;
		}
		return expression.name.text === "each";
	}

	/** Responsibilities: _classification invocation represents Jest_. **/
	private is_test_call(node: ts.CallExpression): boolean {
		if (this.is_each_factory(node)) {
			return false;
		}
		const call_name = this.call_name(node.expression, node);
		if (call_name.length > 0 && this.test_names.has(call_name)) {
			return true;
		}
		if (!ts.isCallExpression(node.expression)) {
			return false;
		}
		return this.is_each_factory(node.expression);
	}

	/** Responsibilities: _collection direct test invocation_. **/
	private direct_tests(node: ts.Node): ts.CallExpression[] {
		const tests: ts.CallExpression[] = [];
		const visit = (child: ts.Node): void => {
			if (ts.isCallExpression(child)) {
				if (this.call_name(child.expression, child) === this.describe_name) {
					return;
				}
			}
			if (ts.isCallExpression(child) && this.is_test_call(child)) {
				tests.push(child);
				return;
			}
			ts.forEachChild(child, visit);
		};
		ts.forEachChild(node, visit);
		return tests;
	}

	/** Responsibilities: _normalization Jest suite invocation_. **/
	private suite_from_call(node: ts.CallExpression, nested: boolean): JestSuite {
		let body: ts.Block[] = [];
		let tests: ts.CallExpression[] = [];
		this.with_callback(node, (callback) => {
			if (callback.body !== undefined && ts.isBlock(callback.body)) {
				body = [callback.body];
			}
			if (callback.body !== undefined) {
				tests = this.direct_tests(callback.body);
			}
		});
		return { node, body, tests, nested };
	}

	/** Responsibilities: _execution callback each discovered_. **/
	public with_callback(node: ts.CallExpression, consumer: CallableConsumer): void {
		const candidate = node.arguments[node.arguments.length - 1];
		if (candidate === undefined) {
			return;
		}
		if (ts.isArrowFunction(candidate) || ts.isFunctionExpression(candidate)) {
			consumer(candidate);
		}
	}

	/** Responsibilities: _collection top-level Jest suites_. **/
	public suites(source_file: ts.SourceFile): JestSuite[] {
		const suites: JestSuite[] = [];
		const visit = (node: ts.Node, nested: boolean): void => {
			if (ts.isCallExpression(node)) {
				if (this.call_name(node.expression, node) !== this.describe_name) {
					ts.forEachChild(node, (child) => visit(child, nested));
					return;
				}
				suites.push(this.suite_from_call(node, nested));
				this.with_callback(node, (callback) => {
					if (callback.body !== undefined) {
						ts.forEachChild(callback.body, (child) => visit(child, true));
					}
				});
				return;
			}
			ts.forEachChild(node, (child) => visit(child, nested));
		};
		ts.forEachChild(source_file, (child) => visit(child, false));
		return suites;
	}
}
