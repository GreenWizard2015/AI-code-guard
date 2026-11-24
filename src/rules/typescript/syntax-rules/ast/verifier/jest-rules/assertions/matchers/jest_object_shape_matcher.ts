import { JEST_ANY_VALUES, JEST_OBJECT, JEST_SHAPES } from "src/constants";
import { JestExpressionMatch } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/assertions/jest_expression_match";
import type { JestExpressionMatchContract, JestMatcherAccessContract } from "src/testing_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _objectContaining shape extraction_, _Jest shape matching_. **/
export class JestObjectShapeMatcher {
	private readonly _shape_matchers: ReadonlySet<string>;
	private readonly _matcher_access: JestMatcherAccessContract;
	private readonly _aliases: TypeScriptExpressionAliasesContract;

	/** Responsibilities: _matcher alias ownership_. **/
	private matcher_alias(expression: ts.Expression, usage: ts.Node): boolean {
		if (!this._matcher_access.receiver_available(expression)) {
			return false;
		}
		const receiver = this._matcher_access.receiver(expression);
		if (!ts.isIdentifier(receiver)) {
			return false;
		}
		return this._aliases.receiver({ expression: receiver, node: usage });
	}

	/** Responsibilities: _Jest any matcher classification_. **/
	private is_any_value(initializer: ts.Expression): boolean {
		if (!ts.isCallExpression(initializer) || !this._matcher_access.receiver_available(initializer.expression)) {
			return false;
		}
		const expression = initializer.expression;
		if (!this.matcher_alias(expression, initializer)) {
			return false;
		}
		return JEST_ANY_VALUES.has(this._matcher_access.member_name(expression));
	}

	/** Responsibilities: _shape object classification_. **/
	private is_shape_object(shape: ts.Expression): boolean {
		if (!ts.isObjectLiteralExpression(shape) || shape.properties.length === 0) {
			return false;
		}
		for (const property of shape.properties) {
			if (!ts.isPropertyAssignment(property) || !this.is_any_value(property.initializer)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _objectContaining invocation matching_. **/
	private object_containing_shape(expected: ts.Expression): JestExpressionMatchContract {
		if (!ts.isCallExpression(expected)) {
			return new JestExpressionMatch(expected, false);
		}
		for (const shape of expected.arguments) {
			const expression = expected.expression;
			if (!this.matcher_alias(expression, expected)) {
				return new JestExpressionMatch(expected, false);
			}
			if (this._matcher_access.member_name(expression) !== JEST_OBJECT) {
				return new JestExpressionMatch(expected, false);
			}
			return new JestExpressionMatch(shape, true);
		}
		return new JestExpressionMatch(expected, false);
	}

	/** Responsibilities: _matcher access ownership_. **/
	public constructor(matcher_access: JestMatcherAccessContract, aliases: TypeScriptExpressionAliasesContract) {
		this._shape_matchers = JEST_SHAPES;
		this._matcher_access = matcher_access;
		this._aliases = aliases;
	}

	/** Responsibilities: _public operation_. **/
	public shape_object(assertion: ts.CallExpression): boolean {
		if (!this.matches(assertion) || assertion.arguments.length === 0) {
			return false;
		}
		const argument = assertion.arguments.at(0);
		if (argument === undefined) {
			return false;
		}
		const shape = this.object_containing_shape(argument);
		if (!shape.value_available()) {
			return false;
		}
		return this.is_shape_object(shape.value());
	}

	/** Responsibilities: _supported matcher identity_. **/
	public matches(assertion: ts.CallExpression): boolean {
		return this._shape_matchers.has(this._matcher_access.member_name(assertion.expression));
	}
}
