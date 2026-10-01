import ts from "typescript";

/** Responsibilities: _unwrapping conditional expression wrappers_. **/
export class TypeScriptConditionExpression {
	private readonly boolean_wrapper_name: string;

	/** Responsibilities: _conditional wrapper removal_. **/
	private unwrap_once(expression: ts.Expression): ts.Expression {
		if (ts.isParenthesizedExpression(expression)) {
			return expression.expression;
		}
		if (ts.isPrefixUnaryExpression(expression)) {
			if (expression.operator === ts.SyntaxKind.ExclamationToken) {
				return expression.operand;
			}
		}
		if (this.boolean_call(expression) && ts.isCallExpression(expression)) {
			return expression.arguments[0];
		}
		return expression;
	}

	/** Responsibilities: _conditional wrapper configuration_. **/
	public constructor(boolean_wrapper_name = "Boolean") {
		this.boolean_wrapper_name = boolean_wrapper_name;
	}

	/** Responsibilities: _Boolean condition classification_. **/
	public boolean_call(expression: ts.Expression): boolean {
		if (!ts.isCallExpression(expression)) {
			return false;
		}
		if (!ts.isIdentifier(expression.expression)) {
			return false;
		}
		if (expression.expression.text !== this.boolean_wrapper_name) {
			return false;
		}
		return expression.arguments.length === 1;
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
