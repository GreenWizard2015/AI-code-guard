import ts from "typescript";

/** Responsibilities: _logical chain measurement_, _long chain detection_. **/
export class TypeScriptLogicalChain {
	private readonly _maximum_characters: number;
	/** Responsibilities: _classification binary node usage_. **/
	private logical_operator(operator_expression: ts.BinaryExpression): boolean {
		const kind = operator_expression.operatorToken.kind;
		if (kind === ts.SyntaxKind.AmpersandAmpersandToken) {
			return true;
		}
		if (kind === ts.SyntaxKind.BarBarToken) {
			return true;
		}
		return kind === ts.SyntaxKind.QuestionQuestionToken;
	}

	/** Responsibilities: _classification logical expression initialization_. **/
	private named_initializer(initializer_expression: ts.BinaryExpression): boolean {
		let parent = initializer_expression.parent;
		while (ts.isParenthesizedExpression(parent)) {
			parent = parent.parent;
		}
		if (!ts.isVariableDeclaration(parent)) {
			return false;
		}
		return parent.initializer === initializer_expression;
	}

	/** Responsibilities: _classification logical expression nested_. **/
	private has_logical_parent(chain_expression: ts.BinaryExpression): boolean {
		let parent = chain_expression.parent;
		while (ts.isParenthesizedExpression(parent)) {
			parent = parent.parent;
		}
		return ts.isBinaryExpression(parent) && this.logical_operator(parent);
	}

	/** Responsibilities: _classification concise arrow expression_. **/
	private expression_lambda(expression_candidate: ts.BinaryExpression): boolean {
		let parent = expression_candidate.parent;
		while (parent !== undefined) {
			if (ts.isArrowFunction(parent)) {
				return !ts.isBlock(parent.body);
			}
			parent = parent.parent;
		}
		return false;
	}

	/** Responsibilities: _chain length policy_. **/
	public constructor(maximum_characters: number) {
		this._maximum_characters = maximum_characters;
	}
	/** Responsibilities: _public operation_. **/
	public logical_part_count(expression: ts.Expression): number {
		if (ts.isParenthesizedExpression(expression)) {
			return this.logical_part_count(expression.expression);
		}
		if (!ts.isBinaryExpression(expression)) {
			return 1;
		}
		if (!this.logical_operator(expression)) {
			return 1;
		}
		return this.logical_part_count(expression.left) + this.logical_part_count(expression.right);
	}

	/** Responsibilities: _long chain detection_. **/
	public long_chain(node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node) || !this.logical_operator(node)) {
			return false;
		}
		if (this.named_initializer(node) || this.has_logical_parent(node)) {
			return false;
		}
		const too_many_parts = this.logical_part_count(node) > 3;
		const too_long = node.getText().replace(/\s+/gu, "").length >= this._maximum_characters;
		const short_arrow = this.expression_lambda(node) && !too_many_parts;
		if (short_arrow) {
			return false;
		}
		return too_many_parts || too_long;
	}
}
