import ts from "typescript";
import {
	JEST_ANY_VALUES,
	JEST_OBJECT,
	JEST_SHAPES,
} from "src/linting/orchestration/runtime/typescript-rule-groups/jest/constants";
import { JestExpressionMatch } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_expression_match";
import type {
	JestExpressionMatchContract,
	JestMatcherAccessContract,
	TypeScriptExpressionAliasesContract,
} from "src/protocols";

/** Responsibilities: _objectContaining shape extraction_, _Jest shape matching_. **/
export class JestObjectShapeMatcher {
	private readonly shape_matchers = JEST_SHAPES;
	private readonly matcher_access: JestMatcherAccessContract;

	/** Responsibilities: _classification expression Jest any-value_. **/
	private is_any_value(node: ts.Expression, context: ts.Node, aliases: TypeScriptExpressionAliasesContract): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		if (!this.matcher_access.receiver_available(node.expression)) {
			return false;
		}
		const receiver = this.matcher_access.receiver(node.expression);
		if (!ts.isIdentifier(receiver)) {
			return false;
		}
		if (!aliases.receiver(receiver, context)) {
			return false;
		}
		return JEST_ANY_VALUES.has(this.matcher_access.member_name(node.expression));
	}

	/** Responsibilities: _classification expression object shape_. **/
	private is_shape_object(
		node: ts.Expression,
		context: ts.Node,
		aliases: TypeScriptExpressionAliasesContract,
	): boolean {
		if (!ts.isObjectLiteralExpression(node)) {
			return false;
		}
		if (node.properties.length === 0) {
			return false;
		}
		for (const property of node.properties) {
			if (!ts.isPropertyAssignment(property)) {
				return false;
			}
			if (!this.is_any_value(property.initializer, context, aliases)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _objectContaining invocation matching_. **/
	private object_containing_shape(
		node: ts.CallExpression,
		aliases: TypeScriptExpressionAliasesContract,
	): JestExpressionMatchContract {
		if (node.arguments.length === 0) {
			return new JestExpressionMatch(node.expression, false);
		}
		const expected = node.arguments[0];
		if (!ts.isCallExpression(expected)) {
			return new JestExpressionMatch(node.expression, false);
		}
		if (!this.is_object_containing(expected, node, aliases)) {
			return new JestExpressionMatch(node.expression, false);
		}
		if (expected.arguments.length === 0) {
			return new JestExpressionMatch(node.expression, false);
		}
		const shape = expected.arguments[0];
		return new JestExpressionMatch(shape, true);
	}

	/** Responsibilities: _classification invocation invokes objectContaining_. **/
	private is_object_containing(
		node: ts.CallExpression,
		context: ts.Node,
		aliases: TypeScriptExpressionAliasesContract,
	): boolean {
		if (!this.matcher_access.receiver_available(node.expression)) {
			return false;
		}
		const receiver = this.matcher_access.receiver(node.expression);
		if (!ts.isIdentifier(receiver)) {
			return false;
		}
		if (!aliases.receiver(receiver, context)) {
			return false;
		}
		return this.matcher_access.member_name(node.expression) === JEST_OBJECT;
	}

	/** Responsibilities: _matcher access ownership_. **/
	public constructor(matcher_access: JestMatcherAccessContract) {
		this.matcher_access = matcher_access;
	}

	/** Responsibilities: _public operation_. **/
	public shape_object(node: ts.CallExpression, aliases: TypeScriptExpressionAliasesContract): boolean {
		if (!this.matches(node)) {
			return false;
		}
		const shape = this.object_containing_shape(node, aliases);
		if (!shape.value_available()) {
			return false;
		}
		return this.is_shape_object(shape.value(), node, aliases);
	}

	/** Responsibilities: _reporting invocation matches supported_. **/
	public matches(node: ts.CallExpression): boolean {
		return this.shape_matchers.has(this.matcher_access.member_name(node.expression));
	}
}
