import ts from "typescript";

/** Responsibilities: _Boolean wrapper recognition_, _conditional expression unwrapping_. **/
export class TypeScriptConditionExpression {
	private readonly _boolean_wrapper_name: string;

	/** Responsibilities: _Boolean wrapper removal_. **/
	private unwrap_boolean_wrapper(call: ts.CallExpression): ts.Expression {
		if (!ts.isIdentifier(call.expression)) {
			return call;
		}
		if (call.expression.text !== this._boolean_wrapper_name) {
			return call;
		}
		if (call.arguments.length !== 1) {
			return call;
		}
		const argument = call.arguments.at(0);
		if (argument === undefined) {
			return call;
		}
		return argument;
	}

	/** Responsibilities: _conditional wrapper configuration_. **/
	public constructor(boolean_wrapper_name = "Boolean") {
		this._boolean_wrapper_name = boolean_wrapper_name;
	}

	/** Responsibilities: _single conditional wrapper removal_. **/
	public unwrap_once(expression: ts.Expression): ts.Expression {
		if (ts.isParenthesizedExpression(expression)) {
			return expression.expression;
		}
		if (ts.isPrefixUnaryExpression(expression)) {
			if (expression.operator === ts.SyntaxKind.ExclamationToken) {
				return expression.operand;
			}
			return expression;
		}
		if (!ts.isCallExpression(expression)) {
			return expression;
		}
		return this.unwrap_boolean_wrapper(expression);
	}

	/** Responsibilities: _conditional expression unwrapping_. **/
	public unwrap(expression: ts.Expression): ts.Expression {
		let current = expression;
		let next = this.unwrap_once(current);
		while (next !== current) {
			current = next;
			next = this.unwrap_once(current);
		}
		return current;
	}
}
