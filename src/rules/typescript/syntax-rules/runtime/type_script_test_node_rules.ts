import ts from "typescript";
import { ConsoleMock } from "src/rules/typescript/syntax-rules/runtime/console_mock";
import type { RuleContextData } from "src/types";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";
import type { TypeScriptTestNodeRulesContract } from "src/protocols";
import { RULE_IDS } from "src/constants";

/** Responsibilities: _Jest assertion checks_, _console mock policy checks_. **/
export class TypeScriptTestNodeRules implements TypeScriptTestNodeRulesContract {
	private readonly console_mock: ConsoleMock;
	private readonly expect_aliases: TypeScriptExpressionAliases;

	/** Responsibilities: _unwrapping expect callee_. **/
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

	/** Responsibilities: _aggregation expectation diagnostics test_. **/
	private append_expect(node: ts.Node, context: RuleContextData): void {
		if (!context.test_file) {
			return;
		}
		if (!ts.isCallExpression(node)) {
			return;
		}
		if (this.inside_test_callback(node)) {
			return;
		}
		const expression = this.unwrapped_expression(node.expression);
		if (this.expect_aliases.receiver(expression, node)) {
			context.append_rule(node, RULE_IDS.assertion_outside_test);
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
		return parent.arguments.some((argument) => {
			const same_position = argument.pos === node.pos && argument.end === node.end;
			return same_position;
		});
	}

	/** Responsibilities: _classification expression Jest test_. **/
	private is_test_expression(expression: ts.Expression): boolean {
		if (ts.isIdentifier(expression)) {
			return expression.text === "test";
		}
		if (!ts.isPropertyAccessExpression(expression) || !ts.isIdentifier(expression.expression)) {
			return false;
		}
		if (expression.expression.text !== "test") {
			return false;
		}
		return expression.name.text === "each";
	}

	/** Responsibilities: _aggregation console-mock console-use diagnostics_. **/
	private append_console_rule(node: ts.Node, context: RuleContextData): void {
		if (this.console_mock.console_mock(node)) {
			context.append_rule(node, RULE_IDS.typescript_console_mock_in_test);
			return;
		}
		if (this.console_mock.console_usage(node)) {
			context.append_rule(node, RULE_IDS.typescript_console_in_test);
		}
	}

	/** Responsibilities: _reporting AST node Jest_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.console_mock = new ConsoleMock();
		this.expect_aliases = new TypeScriptExpressionAliases("expect");
	}
	/** Responsibilities: _public operation_. **/
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
