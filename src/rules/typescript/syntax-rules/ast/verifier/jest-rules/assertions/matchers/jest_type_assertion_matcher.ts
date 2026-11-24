import { JEST_ANY, JEST_INSTANCE, JEST_SHAPES } from "src/constants";
import type { JestMatcherAccessContract } from "src/testing_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _Jest type assertions matching_, _instance matchers identification_. **/
export class JestTypeAssertionMatcher {
	private readonly _shape_matchers: ReadonlySet<string>;
	private readonly _matcher_access: JestMatcherAccessContract;

	/** Responsibilities: _owned Jest any matcher_. **/
	private owned_any_matcher(
		expected: ts.Expression,
		assertion: ts.CallExpression,
		alias_index: TypeScriptExpressionAliasesContract,
	): boolean {
		if (!ts.isCallExpression(expected) || !ts.isPropertyAccessExpression(expected.expression)) {
			return false;
		}
		if (!ts.isIdentifier(expected.expression.expression)) {
			return false;
		}
		if (!alias_index.receiver({ expression: expected.expression.expression, node: assertion })) {
			return false;
		}
		return expected.expression.name.text === JEST_ANY;
	}

	/** Responsibilities: _Jest any matchers identification_. **/
	private is_any_matcher(node: ts.CallExpression, aliases: TypeScriptExpressionAliasesContract): boolean {
		for (const expected of node.arguments) {
			return this.owned_any_matcher(expected, node, aliases);
		}
		return false;
	}

	/** Responsibilities: _matcher access ownership_. **/
	public constructor(matcher_access: JestMatcherAccessContract) {
		this._shape_matchers = JEST_SHAPES;
		this._matcher_access = matcher_access;
	}

	/** Responsibilities: _public operation_. **/
	public instance_matcher(expression: ts.Expression): boolean {
		return this._matcher_access.member_name(expression) === JEST_INSTANCE;
	}

	/** Responsibilities: _identification supported Jest type_. **/
	public matches(node: ts.CallExpression, aliases: TypeScriptExpressionAliasesContract): boolean {
		if (this.instance_matcher(node.expression)) {
			return true;
		}
		const matcher = this._matcher_access.member_name(node.expression);
		if (!this._shape_matchers.has(matcher)) {
			return false;
		}
		return this.is_any_matcher(node, aliases);
	}
}
