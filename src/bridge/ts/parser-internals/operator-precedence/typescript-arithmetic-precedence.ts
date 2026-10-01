import ts from "typescript";

/** Responsibilities: _classification arithmetic precedence boundaries_. **/
export class TypeScriptArithmeticPrecedence {
	private readonly arithmetic_kinds = new Set([
		ts.SyntaxKind.PlusToken,
		ts.SyntaxKind.MinusToken,
		ts.SyntaxKind.AsteriskToken,
		ts.SyntaxKind.SlashToken,
		ts.SyntaxKind.PercentToken,
		ts.SyntaxKind.AsteriskAsteriskToken,
	]);

	/** Responsibilities: _classification arithmetic parent_. **/
	private parent_group(node: ts.BinaryExpression): boolean {
		if (ts.isParenthesizedExpression(node.parent)) {
			return false;
		}
		return this.binary_group(node.parent);
	}

	/** Responsibilities: _classification arithmetic binary_. **/
	private binary_group(node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		return this.arithmetic_kinds.has(node.operatorToken.kind);
	}

	/** Responsibilities: _collection arithmetic operators_. **/
	private append_operators(node: ts.Expression, operators: Set<ts.SyntaxKind>, root_parenthesized: boolean): void {
		if (ts.isParenthesizedExpression(node) && !root_parenthesized) {
			return;
		}
		if (!ts.isBinaryExpression(node)) {
			return;
		}
		if (!this.arithmetic_kinds.has(node.operatorToken.kind)) {
			return;
		}
		operators.add(node.operatorToken.kind);
		this.append_operators(node.left, operators, false);
		this.append_operators(node.right, operators, false);
	}

	/** Responsibilities: _arithmetic operator collection API_. **/
	public arithmetic_operators(node: ts.Expression): ReadonlySet<ts.SyntaxKind> {
		const operators = new Set<ts.SyntaxKind>();
		this.append_operators(node, operators, ts.isParenthesizedExpression(node.parent));
		return operators;
	}

	/** Responsibilities: _mixed arithmetic operator detection_. **/
	public mixed_operator(node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		if (!this.arithmetic_kinds.has(node.operatorToken.kind)) {
			return false;
		}
		if (this.parent_group(node)) {
			return false;
		}
		return this.arithmetic_operators(node).size > 1;
	}
}
