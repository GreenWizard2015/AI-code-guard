import ts from 'typescript';
import { JEST_DEFINED, JEST_EXPECT, JEST_PROPERTY } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/constants';
import { JestExpressionMatch } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/jest-expression-match';

/** Responsibilities: _Jest property assertions matching_, _received values resolution_. **/
export class JestPropertyAssertionMatcher {
	private readonly expected_name = JEST_EXPECT;
	private readonly defined_name = JEST_DEFINED;
	private readonly property_name = JEST_PROPERTY;

	/** Responsibilities: _resolution nested Jest expect_. **/
	private expect_call(node: ts.CallExpression): JestExpressionMatch {
		if (!ts.isPropertyAccessExpression(node.expression)) {
			return new JestExpressionMatch(node.expression, false);
		}
		const expect_call = node.expression.expression;
		if (!ts.isCallExpression(expect_call)) {
			return new JestExpressionMatch(node.expression, false);
		}
		if (!ts.isIdentifier(expect_call.expression)) {
			return new JestExpressionMatch(node.expression, false);
		}
		if (expect_call.expression.text !== this.expected_name) {
			return new JestExpressionMatch(node.expression, false);
		}
		return new JestExpressionMatch(expect_call, true);
	}

	/** Responsibilities: _resolution received value assertion_. **/
	private received_value(node: ts.CallExpression): JestExpressionMatch {
		const expect_call = this.expect_call(node);
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

	/** Responsibilities: _identification assertions received properties_. **/
	public received_property(node: ts.CallExpression): boolean {
		const value = this.received_value(node);
		if (!value.value_available()) {
			return false;
		}
		if (ts.isPropertyAccessExpression(value.value())) {
			return true;
		}
		return ts.isElementAccessExpression(value.value());
	}

	/** Responsibilities: _identification supported Jest property_. **/
	public matches(node: ts.CallExpression): boolean {
		if (!ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		const matcher = node.expression.name.text;
		if (matcher === this.property_name) {
			return node.arguments.length === 1;
		}
		if (matcher !== this.defined_name) {
			return false;
		}
		return this.received_property(node);
	}
}
