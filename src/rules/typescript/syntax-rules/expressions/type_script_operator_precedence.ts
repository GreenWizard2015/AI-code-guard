import { TypeScriptBooleanPrecedenceBoundary } from "src/rules/typescript/syntax-rules/expressions/type_script_boolean_precedence_boundary";
import type { TypeScriptOperatorPrecedenceContract } from "src/protocols";
import ts from "typescript";

/** Responsibilities: _boolean precedence_, _arithmetic precedence_. **/
export class TypeScriptOperatorPrecedence implements TypeScriptOperatorPrecedenceContract {
	private readonly boolean_boundary: TypeScriptBooleanPrecedenceBoundary;
	private readonly operator_kinds: Set<ts.SyntaxKind>;
	/** Responsibilities: _classification binary expression operator_. **/
	private binary_in_group(node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		return this.operator_kinds.has(node.operatorToken.kind);
	}

	/** Responsibilities: _classification binary expression parent_. **/
	private parent_group(node: ts.BinaryExpression): boolean {
		if (ts.isParenthesizedExpression(node.parent)) {
			return false;
		}
		return this.binary_in_group(node.parent);
	}

	/** Responsibilities: _collection binary operators expression_. **/
	private append_binary_operators(
		node: ts.Expression,
		operators: Set<ts.SyntaxKind>,
		root_parenthesized = false,
	): void {
		if (ts.isParenthesizedExpression(node) && !root_parenthesized) {
			return;
		}
		this.append_boolean_operators(node, operators);
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
		if (!this.operator_kinds.has(node.operatorToken.kind)) {
			return;
		}
		operators.add(node.operatorToken.kind);
		this.append_binary_operators(node.left, operators);
		this.append_binary_operators(node.right, operators);
	}

	/** Responsibilities: _detection binary expression mixing_. **/
	private mixed_operators(node: ts.BinaryExpression): boolean {
		const operators = new Set<ts.SyntaxKind>();
		this.append_binary_operators(node, operators, ts.isParenthesizedExpression(node.parent));
		if (!operators.has(ts.SyntaxKind.ExclamationToken)) {
			return operators.size > 1;
		}
		return this.boolean_operator_count(node) >= 2 && operators.size > 1;
	}

	/** Responsibilities: _detection mixed operators node_. **/
	private mixed_group(node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		if (!this.operator_kinds.has(node.operatorToken.kind)) {
			return false;
		}
		if (this.parent_group(node)) {
			return false;
		}
		return this.mixed_operators(node);
	}

	/** Responsibilities: _precedence group operator count_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.boolean_boundary = new TypeScriptBooleanPrecedenceBoundary();
		this.operator_kinds = new Set([
			ts.SyntaxKind.AmpersandAmpersandToken,
			ts.SyntaxKind.BarBarToken,
			ts.SyntaxKind.ExclamationToken,
		]);
	}
	/** Responsibilities: _public operation_. **/
	public boolean_operator_count(node: ts.Expression): number {
		if (ts.isParenthesizedExpression(node)) {
			return 0;
		}
		if (ts.isBinaryExpression(node)) {
			if (!this.operator_kinds.has(node.operatorToken.kind)) {
				return 0;
			}
			return 1 + this.boolean_operator_count(node.left) + this.boolean_operator_count(node.right);
		}
		if (ts.isPrefixUnaryExpression(node)) {
			if (node.operator === ts.SyntaxKind.ExclamationToken) {
				return this.boolean_operator_count(node.operand);
			}
		}
		return 0;
	}

	/** Responsibilities: _reporting mixed boolean arithmetic_. **/
	public mixed_boolean_operator(node: ts.Node): boolean {
		if (this.boolean_boundary.negation_comparison_boundary(node)) {
			return true;
		}
		if (!ts.isBinaryExpression(node) || !this.boolean_boundary.boolean_operator(node)) {
			return false;
		}
		if (this.parent_group(node)) {
			return false;
		}
		if (this.mixed_group(node)) {
			return true;
		}
		return false;
	}
}
