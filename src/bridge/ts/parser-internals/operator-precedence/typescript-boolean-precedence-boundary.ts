import ts from "typescript";

/** Responsibilities: _classification boolean precedence boundaries_. **/
export class TypeScriptBooleanPrecedenceBoundary {
	private readonly boolean_operators = new Set([
		ts.SyntaxKind.AmpersandAmpersandToken,
		ts.SyntaxKind.BarBarToken,
		ts.SyntaxKind.ExclamationToken,
	]);

	/** Responsibilities: _simple boolean prefix detection_. **/
	private simple_prefix(node: ts.PrefixUnaryExpression): boolean {
		if (node.operator !== ts.SyntaxKind.ExclamationToken) {
			return false;
		}
		return this.simple_operand(node.operand);
	}

	/** Responsibilities: _simple boolean wrapper detection_. **/
	private simple_type_wrapper(node: ts.Expression): boolean {
		if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
			return this.simple_operand(node.expression);
		}
		if (ts.isTypeAssertionExpression(node)) {
			return this.simple_operand(node.expression);
		}
		return false;
	}

	/** Responsibilities: _simple execution wrapper detection_. **/
	private simple_execution_wrapper(node: ts.Expression): boolean {
		if (ts.isNonNullExpression(node)) {
			return this.simple_operand(node.expression);
		}
		if (ts.isAwaitExpression(node)) {
			return this.simple_operand(node.expression);
		}
		return false;
	}

	/** Responsibilities: _simple conditional wrapper detection_. **/
	private simple_conditional_wrapper(node: ts.Expression): boolean {
		if (!ts.isConditionalExpression(node)) {
			return false;
		}
		if (!this.simple_operand(node.whenTrue)) {
			return false;
		}
		return this.simple_operand(node.whenFalse);
	}

	/** Responsibilities: _simple boolean wrapper detection_. **/
	private simple_wrapper(node: ts.Expression): boolean {
		if (this.simple_type_wrapper(node)) {
			return true;
		}
		if (this.simple_execution_wrapper(node)) {
			return true;
		}
		return this.simple_conditional_wrapper(node);
	}

	/** Responsibilities: _simple boolean operand detection_. **/
	private simple_value_operand(node: ts.Expression): boolean {
		if (node.kind === ts.SyntaxKind.TrueKeyword) {
			return true;
		}
		if (node.kind === ts.SyntaxKind.FalseKeyword) {
			return true;
		}
		if (ts.isIdentifier(node)) {
			return true;
		}
		return false;
	}

	/** Responsibilities: _simple member operand detection_. **/
	private simple_member_operand(node: ts.Expression): boolean {
		if (ts.isPropertyAccessExpression(node)) {
			return true;
		}
		if (ts.isCallExpression(node)) {
			return true;
		}
		if (ts.isNewExpression(node)) {
			return true;
		}
		return ts.isElementAccessExpression(node);
	}

	/** Responsibilities: _simple boolean chain detection_. **/
	private simple_boolean_chain(node: ts.BinaryExpression): boolean {
		if (!this.boolean_operators.has(node.operatorToken.kind)) {
			return false;
		}
		if (!this.simple_operand(node.left)) {
			return false;
		}
		return this.simple_operand(node.right);
	}

	/** Responsibilities: _simple boolean operand detection_. **/
	private simple_direct_operand(node: ts.Expression): boolean {
		if (this.simple_value_operand(node)) {
			return true;
		}
		if (this.simple_member_operand(node)) {
			return true;
		}
		if (ts.isBinaryExpression(node)) {
			return this.simple_boolean_chain(node);
		}
		return this.simple_wrapper(node);
	}

	/** Responsibilities: _simple boolean operand detection_. **/
	private simple_operand(node: ts.Expression): boolean {
		if (this.simple_direct_operand(node)) {
			return true;
		}
		if (ts.isPrefixUnaryExpression(node)) {
			return this.simple_prefix(node);
		}
		return false;
	}

	/** Responsibilities: _ungrouped precedence boundary detection_. **/
	private ungrouped_unary(node: ts.PrefixUnaryExpression): boolean {
		if (node.operator !== ts.SyntaxKind.ExclamationToken) {
			return false;
		}
		return this.ungrouped_boundary(node.operand);
	}

	/** Responsibilities: _ungrouped precedence boundary detection_. **/
	private ungrouped_boundary(node: ts.Expression): boolean {
		if (ts.isParenthesizedExpression(node)) {
			return false;
		}
		if (!ts.isBinaryExpression(node)) {
			if (ts.isPrefixUnaryExpression(node)) {
				return this.ungrouped_unary(node);
			}
			return false;
		}
		if (!this.boolean_operators.has(node.operatorToken.kind)) {
			return true;
		}
		if (this.ungrouped_boundary(node.left)) {
			return true;
		}
		return this.ungrouped_boundary(node.right);
	}

	/** Responsibilities: _negation comparison boundary detection_. **/
	private negation_comparison(node: ts.BinaryExpression): boolean {
		if (this.boolean_operators.has(node.operatorToken.kind)) {
			return false;
		}
		return this.direct_negation(node.left) || this.direct_negation(node.right);
	}

	/** Responsibilities: _direct negation operand detection_. **/
	private direct_negation(node: ts.Expression): boolean {
		if (!ts.isPrefixUnaryExpression(node)) {
			return false;
		}
		if (node.operator !== ts.SyntaxKind.ExclamationToken) {
			return false;
		}
		return !ts.isParenthesizedExpression(node.parent);
	}

	/** Responsibilities: _simple boolean operand API_. **/
	public boolean_operator(node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		return this.boolean_operators.has(node.operatorToken.kind);
	}

	/** Responsibilities: _ungrouped boolean operator detection_. **/
	public ungrouped_boolean_operator(node: ts.BinaryExpression): boolean {
		if (!this.boolean_operators.has(node.operatorToken.kind)) {
			return false;
		}
		const left_boundary = this.ungrouped_boundary(node.left);
		const right_boundary = this.ungrouped_boundary(node.right);
		if (left_boundary) {
			if (this.simple_operand(node.right)) {
				return true;
			}
		}
		if (right_boundary) {
			if (this.simple_operand(node.left)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _negation precedence boundary API_. **/
	public negation_comparison_boundary(node: ts.Node): boolean {
		return ts.isBinaryExpression(node) && this.negation_comparison(node);
	}
}
