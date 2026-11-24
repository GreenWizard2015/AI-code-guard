import { JEST_DEFINED, JEST_PROPERTY } from "src/constants";
import { JestExpressionMatch } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/assertions/jest_expression_match";
import type { JestExpressionMatchContract, JestMatcherAccessContract } from "src/testing_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _Jest property assertions matching_, _received values resolution_. **/
export class JestPropertyAssertionMatcher {
	private readonly _defined_name: string;
	private readonly _property_name: string;
	private readonly _matcher_access: JestMatcherAccessContract;

	/** Responsibilities: _expect call ownership_. **/
	private owned_expect_call(
		matcher_call: ts.CallExpression,
		assertion_call: ts.CallExpression,
		alias_index: TypeScriptExpressionAliasesContract,
	): boolean {
		if (!ts.isIdentifier(matcher_call.expression)) {
			return false;
		}
		return alias_index.receiver({ expression: matcher_call.expression, node: assertion_call });
	}

	/** Responsibilities: _received assertion value_. **/
	private received_value(
		expect_call: ts.CallExpression,
		assertion_call: ts.CallExpression,
		aliases: TypeScriptExpressionAliasesContract,
	): JestExpressionMatchContract {
		if (!this.owned_expect_call(expect_call, assertion_call, aliases)) {
			return new JestExpressionMatch(assertion_call.expression, false);
		}
		for (const received of expect_call.arguments) {
			return new JestExpressionMatch(received, true);
		}
		return new JestExpressionMatch(assertion_call.expression, false);
	}

	/** Responsibilities: _matcher access ownership_. **/
	public constructor(matcher_access: JestMatcherAccessContract) {
		this._matcher_access = matcher_access;
		this._defined_name = JEST_DEFINED;
		this._property_name = JEST_PROPERTY;
	}

	/** Responsibilities: _received property access_. **/
	public received_property(received: JestExpressionMatchContract): boolean {
		if (!received.value_available()) {
			return false;
		}
		const value = received.value();
		return ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value);
	}

	/** Responsibilities: _identification supported Jest property_. **/
	public matches(node: ts.CallExpression, aliases: TypeScriptExpressionAliasesContract): boolean {
		const matcher = this._matcher_access.member_name(node.expression);
		if (matcher === this._property_name) {
			return node.arguments.length === 1;
		}
		if (matcher !== this._defined_name) {
			return false;
		}
		if (!this._matcher_access.receiver_available(node.expression)) {
			return false;
		}
		const expect_call = this._matcher_access.receiver(node.expression);
		if (!ts.isCallExpression(expect_call)) {
			return false;
		}
		return this.received_property(this.received_value(expect_call, node, aliases));
	}
}
