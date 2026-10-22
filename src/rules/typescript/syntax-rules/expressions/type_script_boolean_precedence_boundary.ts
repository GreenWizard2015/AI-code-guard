import ts from "typescript";

/** Responsibilities: _boolean operand boundary detection_, _precedence grouping recognition_. **/
export class TypeScriptBooleanPrecedenceBoundary {
	private readonly boolean_operators: Set<ts.SyntaxKind>;
	private readonly comparison_operators: Set<ts.SyntaxKind>;

	/** Responsibilities: _negation comparison boundary detection_. **/
	private negation_comparison(node: ts.BinaryExpression): boolean {
		if (!this.comparison_operators.has(node.operatorToken.kind)) {
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

	/** Responsibilities: _boolean operator policy_. **/
	constructor() {
		this.boolean_operators = new Set([
			ts.SyntaxKind.AmpersandAmpersandToken,
			ts.SyntaxKind.BarBarToken,
			ts.SyntaxKind.ExclamationToken,
		]);
		this.comparison_operators = new Set([
			ts.SyntaxKind.EqualsEqualsToken,
			ts.SyntaxKind.EqualsEqualsEqualsToken,
			ts.SyntaxKind.ExclamationEqualsToken,
			ts.SyntaxKind.ExclamationEqualsEqualsToken,
			ts.SyntaxKind.LessThanToken,
			ts.SyntaxKind.LessThanEqualsToken,
			ts.SyntaxKind.GreaterThanToken,
			ts.SyntaxKind.GreaterThanEqualsToken,
			ts.SyntaxKind.InKeyword,
			ts.SyntaxKind.InstanceOfKeyword,
		]);
	}
	/** Responsibilities: _public operation_. **/
	public boolean_operator(node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		return this.boolean_operators.has(node.operatorToken.kind);
	}

	/** Responsibilities: _negation precedence boundary API_. **/
	public negation_comparison_boundary(node: ts.Node): boolean {
		return ts.isBinaryExpression(node) && this.negation_comparison(node);
	}
}
