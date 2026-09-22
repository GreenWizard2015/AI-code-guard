import ts from 'typescript';
import { JEST_ANY, JEST_EXPECT, JEST_INSTANCE, JEST_SHAPES } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/constants';

/** Responsibilities: _Jest type assertions matching_, _instance matchers identification_. **/
export class JestTypeAssertionMatcher {
	private readonly shape_matchers = JEST_SHAPES;

	/** Responsibilities: _Jest any matchers identification_. **/
	private is_any_matcher(node: ts.CallExpression): boolean {
		const expected = node.arguments[0];
		if (expected === undefined || !ts.isCallExpression(expected)) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(expected.expression)) {
			return false;
		}
		if (!ts.isIdentifier(expected.expression.expression)) {
			return false;
		}
		return expected.expression.expression.text === JEST_EXPECT && expected.expression.name.text === JEST_ANY;
	}

	/** Responsibilities: _Jest instance matchers identification_. **/
	public instance_matcher(node: ts.CallExpression): boolean {
		if (!ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		return node.expression.name.text === JEST_INSTANCE;
	}

	/** Responsibilities: _identification supported Jest type_. **/
	public matches(node: ts.CallExpression): boolean {
		if (this.instance_matcher(node)) {
			return true;
		}
		if (!ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		const matcher = node.expression.name.text;
		if (!this.shape_matchers.has(matcher)) {
			return false;
		}
		return this.is_any_matcher(node);
	}
}
