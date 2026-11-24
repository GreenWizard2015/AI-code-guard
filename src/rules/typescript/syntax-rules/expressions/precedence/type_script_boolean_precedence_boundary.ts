import ts from "typescript";

/** Responsibilities: _boolean operand boundary detection_, _precedence grouping recognition_. **/
export class TypeScriptBooleanPrecedenceBoundary {
	private readonly _boolean_operators: ReadonlySet<ts.SyntaxKind>;
	private readonly _comparison_operators: ReadonlySet<ts.SyntaxKind>;

	/** Responsibilities: _negation comparison boundary detection_. **/
	private negation_comparison(node: ts.BinaryExpression): boolean {
		if (!this._comparison_operators.has(node.operatorToken.kind)) {
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

	/** Responsibilities: _boolean precedence policy ownership_. **/
	public constructor(boolean_operators: ReadonlySet<ts.SyntaxKind>, comparison_operators: ReadonlySet<ts.SyntaxKind>) {
		this._boolean_operators = boolean_operators;
		this._comparison_operators = comparison_operators;
	}
	/** Responsibilities: _public operation_. **/
	public boolean_operator(node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		return this._boolean_operators.has(node.operatorToken.kind);
	}

	/** Responsibilities: _negation precedence boundary API_. **/
	public negation_comparison_boundary(node: ts.Node): boolean {
		return ts.isBinaryExpression(node) && this.negation_comparison(node);
	}
}
