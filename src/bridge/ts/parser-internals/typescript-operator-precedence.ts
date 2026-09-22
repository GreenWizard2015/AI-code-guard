import ts from 'typescript';

/** Responsibilities: _classification mixed boolean arithmetic_. **/
export class TypeScriptOperatorPrecedence {
	private readonly boolean_operators = new Set([
		ts.SyntaxKind.AmpersandAmpersandToken,
		ts.SyntaxKind.BarBarToken,
		ts.SyntaxKind.ExclamationToken,
	]);
	private readonly arithmetic_operators = new Set([
		ts.SyntaxKind.PlusToken,
		ts.SyntaxKind.MinusToken,
		ts.SyntaxKind.AsteriskToken,
		ts.SyntaxKind.SlashToken,
	]);

	/** Responsibilities: _classification operator belongs selection_. **/
	private operator_in_group(kind: ts.SyntaxKind, boolean_group: boolean): boolean {
		if (boolean_group) {
			return this.boolean_operators.has(kind);
		}
		return this.arithmetic_operators.has(kind);
	}

	/** Responsibilities: _classification binary expression operator_. **/
	private binary_in_group(node: ts.Node, boolean_group: boolean): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		return this.operator_in_group(node.operatorToken.kind, boolean_group);
	}

	/** Responsibilities: _classification binary expression parent_. **/
	private parent_group(node: ts.BinaryExpression, boolean_group: boolean): boolean {
		if (ts.isParenthesizedExpression(node.parent)) {
			return false;
		}
		return this.binary_in_group(node.parent, boolean_group);
	}

	/** Responsibilities: _collection binary operators expression_. **/
	private append_binary_operators(
		node: ts.Expression,
		operators: Set<ts.SyntaxKind>,
		boolean_group: boolean
	): void {
		if (ts.isParenthesizedExpression(node)) {
			return;
		}
		if (boolean_group) {
			this.append_boolean_operators(node, operators);
			return;
		}
		this.append_arithmetic_operators(node, operators);
	}

	/** Responsibilities: _collection boolean operators expression_. **/
	private append_boolean_operators(node: ts.Expression, operators: Set<ts.SyntaxKind>): void {
		if (ts.isPrefixUnaryExpression(node)) {
			if (node.operator === ts.SyntaxKind.ExclamationToken) {
				operators.add(node.operator);
			}
			return;
		}
		if (!ts.isBinaryExpression(node)) {
			return;
		}
		if (!this.operator_in_group(node.operatorToken.kind, true)) {
			return;
		}
		operators.add(node.operatorToken.kind);
		this.append_binary_operators(node.left, operators, true);
		this.append_binary_operators(node.right, operators, true);
	}

	/** Responsibilities: _collection arithmetic operators expression_. **/
	private append_arithmetic_operators(node: ts.Expression, operators: Set<ts.SyntaxKind>): void {
		if (!ts.isBinaryExpression(node)) {
			return;
		}
		if (!this.operator_in_group(node.operatorToken.kind, false)) {
			return;
		}
		operators.add(node.operatorToken.kind);
		this.append_arithmetic_operators(node.left, operators);
		this.append_arithmetic_operators(node.right, operators);
	}

	/** Responsibilities: _precedence group operator count_. **/
	private binary_operator_count(node: ts.Expression, boolean_group: boolean): number {
		if (ts.isParenthesizedExpression(node)) {
			return 0;
		}
		if (ts.isBinaryExpression(node)) {
			if (!this.operator_in_group(node.operatorToken.kind, boolean_group)) {
				return 0;
			}
			return 1 + this.binary_operator_count(node.left, boolean_group) +
				this.binary_operator_count(node.right, boolean_group);
		}
		if (boolean_group && ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
			return this.binary_operator_count(node.operand, true);
		}
		return 0;
	}

	/** Responsibilities: _detection binary expression mixing_. **/
	private mixed_operators(node: ts.BinaryExpression, boolean_group: boolean): boolean {
		const operators = new Set<ts.SyntaxKind>();
		this.append_binary_operators(node, operators, boolean_group);
		if (!boolean_group) {
			return operators.size > 1;
		}
		if (!operators.has(ts.SyntaxKind.ExclamationToken)) {
			return operators.size > 1;
		}
		return this.binary_operator_count(node, true) >= 2 && operators.size > 1;
	}

	/** Responsibilities: _detection mixed operators node_. **/
	private mixed_group(node: ts.Node, boolean_group: boolean): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		if (!this.operator_in_group(node.operatorToken.kind, boolean_group)) {
			return false;
		}
		if (this.parent_group(node, boolean_group)) {
			return false;
		}
		return this.mixed_operators(node, boolean_group);
	}

	/** Responsibilities: _reporting mixed boolean arithmetic_. **/
	public mixed_boolean_operator(node: ts.Node): boolean {
		return this.mixed_group(node, true);
	}

	/** Responsibilities: _reporting mixed arithmetic boolean_. **/
	public mixed_arithmetic_operator(node: ts.Node): boolean {
		return this.mixed_group(node, false);
	}
}
