import ts from 'typescript';
import { ConsoleMock } from 'src/bridge/ts/parser-internals/console-mock';
import type { RuleContextData } from 'src/types';

/** Responsibilities: _classification Jest test callbacks_. **/
export class TypeScriptTestNodeRules {
	private readonly console_mock = new ConsoleMock();

	/** Responsibilities: _aggregation expectation diagnostics test_. **/
	private append_expect(node: ts.Node, context: RuleContextData): void {
		if ((!context.test_file) || (!ts.isCallExpression(node)) || this.inside_test_callback(node)) {
			return;
		}
		const expression = node.expression;
		if (!ts.isIdentifier(expression)) {
			return;
		}
		if (expression.text === 'expect') {
			context.append_rule(node, 'assertion-outside-test');
		}
	}

	/** Responsibilities: _classification node inside Jest_. **/
	private inside_test_callback(node: ts.Node): boolean {
		let current = node.parent;
		while (current !== undefined) {
if (ts.isFunctionLike(current) && this.is_test_callback(current)) {
				return true;
			}
			current = current.parent;
		}
		return false;
	}

	/** Responsibilities: _classification node Jest callback_. **/
	private is_test_callback(node: ts.Node): boolean {
		const parent = node.parent;
		if (!ts.isCallExpression(parent)) {
			return false;
		}
		let expression = parent.expression;
		if (ts.isCallExpression(expression)) {
			expression = expression.expression;
		}
		if (!this.is_test_expression(expression)) {
			return false;
		}
		return parent.arguments.some(argument => {
			const same_position = argument.pos === node.pos && argument.end === node.end;
			return same_position;
		});
	}

	/** Responsibilities: _classification expression Jest test_. **/
	private is_test_expression(expression: ts.Expression): boolean {
		if (ts.isIdentifier(expression)) {
			return expression.text === 'test';
		}
if (!ts.isPropertyAccessExpression(expression) || !ts.isIdentifier(expression.expression)) {
			return false;
		}
		if (expression.expression.text !== 'test') {
			return false;
		}
		return expression.name.text === 'each';
	}

	/** Responsibilities: _aggregation console-mock console-use diagnostics_. **/
	private append_console_rule(node: ts.Node, context: RuleContextData): void {
		if (this.console_mock.console_mock(node)) {
			context.append_rule(node, 'typescript-console-mock-in-test');
			return;
		}
		if (this.console_mock.console_usage(node)) {
			context.append_rule(node, 'typescript-console-in-test');
		}
	}

	/** Responsibilities: _reporting AST node Jest_. **/
	public test_node(node: ts.Node): boolean {
		return ts.isCallExpression(node) || ts.isBinaryExpression(node);
	}

	/** Responsibilities: _aggregation test-specific rules applicable_. **/
	public append_rules(node: ts.Node, context: RuleContextData): void {
		this.append_expect(node, context);
		if (!context.test_file) {
			return;
		}
		this.append_console_rule(node, context);
	}
}
