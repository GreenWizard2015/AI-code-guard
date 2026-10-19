import ts from "typescript";
import { MAX_CALLABLE_CHARACTERS } from "src/constants";

/** Responsibilities: _logical chain measurement_, _long chain detection_. **/
export class TypeScriptLogicalChain {
	private readonly maximum_characters = MAX_CALLABLE_CHARACTERS;
	/** Responsibilities: _classification binary node usage_. **/
	private logical_operator(node: ts.BinaryExpression): boolean {
		const kind = node.operatorToken.kind;
		if (kind === ts.SyntaxKind.AmpersandAmpersandToken) {
			return true;
		}
		if (kind === ts.SyntaxKind.BarBarToken) {
			return true;
		}
		return kind === ts.SyntaxKind.QuestionQuestionToken;
	}

	/** Responsibilities: _classification logical expression initialization_. **/
	private named_initializer(node: ts.BinaryExpression): boolean {
		let parent = node.parent;
		while (ts.isParenthesizedExpression(parent)) {
			parent = parent.parent;
		}
		if (!ts.isVariableDeclaration(parent)) {
			return false;
		}
		return parent.initializer === node;
	}

	/** Responsibilities: _classification logical expression nested_. **/
	private has_logical_parent(node: ts.BinaryExpression): boolean {
		let parent = node.parent;
		while (ts.isParenthesizedExpression(parent)) {
			parent = parent.parent;
		}
		return ts.isBinaryExpression(parent) && this.logical_operator(parent);
	}

	/** Responsibilities: _classification concise arrow expression_. **/
	private expression_lambda(node: ts.BinaryExpression): boolean {
		let parent = node.parent;
		while (parent !== undefined) {
			if (ts.isArrowFunction(parent)) {
				return !ts.isBlock(parent.body);
			}
			parent = parent.parent;
		}
		return false;
	}

	/** Responsibilities: _logical expression part count_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {}
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

	/** Responsibilities: _reporting logical chains exceeding_. **/
	public long_chain(node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node) || !this.logical_operator(node)) {
			return false;
		}
		if (this.named_initializer(node) || this.has_logical_parent(node)) {
			return false;
		}
		const too_many_parts = this.logical_part_count(node) > 3;
		const too_long = node.getText().replace(/\s+/gu, "").length >= this.maximum_characters;
		const short_arrow = this.expression_lambda(node) && !too_many_parts;
		if (short_arrow) {
			return false;
		}
		return too_many_parts || too_long;
	}
}
