import ts from "typescript";
import { JEST_ANY, JEST_INSTANCE, JEST_SHAPES } from "src/constants";
import type { JestMatcherAccessContract } from "src/testing_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _Jest type assertions matching_, _instance matchers identification_. **/
export class JestTypeAssertionMatcher {
	private readonly shape_matchers = JEST_SHAPES;
	private readonly matcher_access: JestMatcherAccessContract;

	/** Responsibilities: _Jest any matchers identification_. **/
	private is_any_matcher(node: ts.CallExpression, aliases: TypeScriptExpressionAliasesContract): boolean {
		if (node.arguments.length === 0) {
			return false;
		}
		const expected = node.arguments[0];
		if (!ts.isCallExpression(expected)) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(expected.expression)) {
			return false;
		}
		if (!ts.isIdentifier(expected.expression.expression)) {
			return false;
		}
		if (!aliases.receiver(expected.expression.expression, node)) {
			return false;
		}
		return expected.expression.name.text === JEST_ANY;
	}

	/** Responsibilities: _matcher access ownership_. **/
	public constructor(matcher_access: JestMatcherAccessContract) {
		this.matcher_access = matcher_access;
	}

	/** Responsibilities: _public operation_. **/
	public instance_matcher(node: ts.CallExpression): boolean {
		return this.matcher_access.member_name(node.expression) === JEST_INSTANCE;
	}

	/** Responsibilities: _identification supported Jest type_. **/
	public matches(node: ts.CallExpression, aliases: TypeScriptExpressionAliasesContract): boolean {
		if (this.instance_matcher(node)) {
			return true;
		}
		const matcher = this.matcher_access.member_name(node.expression);
		if (!this.shape_matchers.has(matcher)) {
			return false;
		}
		return this.is_any_matcher(node, aliases);
	}
}
