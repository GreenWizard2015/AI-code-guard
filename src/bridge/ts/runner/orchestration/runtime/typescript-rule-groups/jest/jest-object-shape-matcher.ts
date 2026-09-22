import ts from 'typescript';
import { JEST_ANY_VALUES, JEST_EXPECT, JEST_OBJECT, JEST_SHAPES } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/constants';
import { JestExpressionMatch } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/jest-expression-match';

/** Responsibilities: _Jest objectContaining shapes matching_. **/
export class JestObjectShapeMatcher {
	private readonly shape_matchers = JEST_SHAPES;

	/** Responsibilities: _classification expression Jest any-value_. **/
	private is_any_value(node: ts.Expression): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		if (!ts.isIdentifier(node.expression.expression)) {
			return false;
		}
		if (node.expression.expression.text !== JEST_EXPECT) {
			return false;
		}
		return JEST_ANY_VALUES.has(node.expression.name.text);
	}

	/** Responsibilities: _classification expression object shape_. **/
	private is_shape_object(node: ts.Expression): boolean {
		if (!ts.isObjectLiteralExpression(node) || node.properties.length === 0) {
			return false;
		}
		for (const property of node.properties) {
			if (!ts.isPropertyAssignment(property) || !this.is_any_value(property.initializer)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _objectContaining invocation matching_. **/
	private object_containing_shape(node: ts.CallExpression): JestExpressionMatch {
		const expected = node.arguments[0];
		if (expected === undefined || !ts.isCallExpression(expected)) {
			return new JestExpressionMatch(node.expression, false);
		}
		if (!this.is_object_containing(expected)) {
			return new JestExpressionMatch(node.expression, false);
		}
		if (expected.arguments.length === 0) {
			return new JestExpressionMatch(node.expression, false);
		}
		const shape = expected.arguments[0];
		return new JestExpressionMatch(shape, true);
	}

	/** Responsibilities: _classification invocation invokes objectContaining_. **/
	private is_object_containing(node: ts.CallExpression): boolean {
		if (!ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		if (!ts.isIdentifier(node.expression.expression)) {
			return false;
		}
		if (node.expression.expression.text !== JEST_EXPECT) {
			return false;
		}
		return node.expression.name.text === JEST_OBJECT;
	}

	/** Responsibilities: _reporting invocation contains valid_. **/
	public shape_object(node: ts.CallExpression): boolean {
		if (!this.matches(node)) {
			return false;
		}
		const shape = this.object_containing_shape(node);
		if (!shape.value_available()) {
			return false;
		}
		return this.is_shape_object(shape.value());
	}

	/** Responsibilities: _reporting invocation matches supported_. **/
	public matches(node: ts.CallExpression): boolean {
		if (!ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		return this.shape_matchers.has(node.expression.name.text);
	}
}
