import ts from 'typescript';
import { JEST_EXCEPTIONS } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/constants';
import { JestObjectShapeMatcher } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/jest-object-shape-matcher';
import { JestPropertyAssertionMatcher } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/jest-property-assertion-matcher';
import { JestTypeAssertionMatcher } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/jest-type-assertion-matcher';

/** Responsibilities: _Jest shape assertions matching_, _Jest exception assertions matching_. **/
export class JestAssertionShapeMatcher {
	private readonly type_assertion = new JestTypeAssertionMatcher();
	private readonly property_assertion = new JestPropertyAssertionMatcher();
	private readonly object_shape = new JestObjectShapeMatcher();
	private readonly exception_matchers = JEST_EXCEPTIONS;

	/** Responsibilities: _Jest shape assertions identification_. **/
	public shape_assertion(node: ts.CallExpression): boolean {
		if (this.type_assertion.matches(node)) {
			return true;
		}
		if (this.property_assertion.matches(node)) {
			return true;
		}
		return this.object_shape.shape_object(node);
	}

	/** Responsibilities: _Jest exception assertions identification_. **/
	public exception_assertion(node: ts.CallExpression): boolean {
		if (!ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		return this.exception_matchers.has(node.expression.name.text);
	}
}
