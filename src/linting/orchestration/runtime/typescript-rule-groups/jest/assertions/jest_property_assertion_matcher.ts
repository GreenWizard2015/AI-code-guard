import ts from "typescript";
import { JEST_DEFINED, JEST_PROPERTY } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/constants";
import { JestExpressionMatch } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_expression_match";
import type {
	JestExpressionMatchContract,
	JestMatcherAccessContract,
	TypeScriptExpressionAliasesContract,
} from "src/protocols";

/** Responsibilities: _Jest property assertions matching_, _received values resolution_. **/
export class JestPropertyAssertionMatcher {
	private readonly defined_name = JEST_DEFINED;
	private readonly property_name = JEST_PROPERTY;
	private readonly matcher_access: JestMatcherAccessContract;

	/** Responsibilities: _resolution nested Jest expect_. **/
	private expect_call(
		node: ts.CallExpression,
		aliases: TypeScriptExpressionAliasesContract,
	): JestExpressionMatchContract {
		if (!this.matcher_access.receiver_available(node.expression)) {
			return new JestExpressionMatch(node.expression, false);
		}
		const matcher_receiver = this.matcher_access.receiver(node.expression);
		const expect_call = matcher_receiver;
		if (!ts.isCallExpression(expect_call)) {
			return new JestExpressionMatch(node.expression, false);
		}
		if (!ts.isIdentifier(expect_call.expression)) {
			return new JestExpressionMatch(node.expression, false);
		}
		if (!aliases.receiver(expect_call.expression, node)) {
			return new JestExpressionMatch(node.expression, false);
		}
		return new JestExpressionMatch(expect_call, true);
	}

	/** Responsibilities: _resolution received value assertion_. **/
	private received_value(
		node: ts.CallExpression,
		aliases: TypeScriptExpressionAliasesContract,
	): JestExpressionMatchContract {
		const expect_call = this.expect_call(node, aliases);
		if (!expect_call.value_available()) {
			return new JestExpressionMatch(node.expression, false);
		}
		const expect_expression = expect_call.value();
		if (!ts.isCallExpression(expect_expression)) {
			return new JestExpressionMatch(node.expression, false);
		}
		if (expect_expression.arguments.length === 0) {
			return new JestExpressionMatch(node.expression, false);
		}
		const received = expect_expression.arguments[0];
		return new JestExpressionMatch(received, true);
	}

	/** Responsibilities: _matcher access ownership_. **/
	public constructor(matcher_access: JestMatcherAccessContract) {
		this.matcher_access = matcher_access;
	}

	/** Responsibilities: _public operation_. **/
	public received_property(node: ts.CallExpression, aliases: TypeScriptExpressionAliasesContract): boolean {
		const value = this.received_value(node, aliases);
		if (!value.value_available()) {
			return false;
		}
		if (ts.isPropertyAccessExpression(value.value())) {
			return true;
		}
		return ts.isElementAccessExpression(value.value());
	}

	/** Responsibilities: _identification supported Jest property_. **/
	public matches(node: ts.CallExpression, aliases: TypeScriptExpressionAliasesContract): boolean {
		const matcher = this.matcher_access.member_name(node.expression);
		if (matcher === this.property_name) {
			return node.arguments.length === 1;
		}
		if (matcher !== this.defined_name) {
			return false;
		}
		return this.received_property(node, aliases);
	}
}
