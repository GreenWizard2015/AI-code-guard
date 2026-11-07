import ts from "typescript";

/** Responsibilities: _arithmetic operator grouping_, _mixed precedence detection_. **/
export class TypeScriptArithmeticPrecedence {
	private readonly _arithmetic_kinds: ReadonlySet<ts.SyntaxKind>;

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
		return this._arithmetic_kinds.has(node.operatorToken.kind);
	}

	/** Responsibilities: _collection arithmetic operators_. **/
	private append_operators(node: ts.Expression, operators: Set<ts.SyntaxKind>, root_parenthesized: boolean): void {
		if (ts.isParenthesizedExpression(node) && !root_parenthesized) {
			return;
		}
		if (!ts.isBinaryExpression(node)) {
			return;
		}
		if (!this._arithmetic_kinds.has(node.operatorToken.kind)) {
			return;
		}
		operators.add(node.operatorToken.kind);
		this.append_operators(node.left, operators, false);
		this.append_operators(node.right, operators, false);
	}

	/** Responsibilities: _arithmetic precedence policy ownership_. **/
	public constructor(arithmetic_kinds: ReadonlySet<ts.SyntaxKind>) {
		this._arithmetic_kinds = arithmetic_kinds;
	}
	/** Responsibilities: _public operation_. **/
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
		if (!this._arithmetic_kinds.has(node.operatorToken.kind)) {
			return false;
		}
		if (this.parent_group(node)) {
			return false;
		}
		return this.arithmetic_operators(node).size > 1;
	}
}
