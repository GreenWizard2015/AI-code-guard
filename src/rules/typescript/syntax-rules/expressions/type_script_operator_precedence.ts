import { TypeScriptBooleanPrecedenceBoundary } from "src/rules/typescript/syntax-rules/expressions/type_script_boolean_precedence_boundary";
import type { TypeScriptOperatorPrecedenceContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _boolean precedence_, _arithmetic precedence_. **/
export class TypeScriptOperatorPrecedence implements TypeScriptOperatorPrecedenceContract {
	private readonly _boolean_boundary: TypeScriptBooleanPrecedenceBoundary;
	private readonly _operator_kinds: Set<ts.SyntaxKind>;
	private readonly _comparison_kinds: ReadonlySet<ts.SyntaxKind>;
	/** Responsibilities: _classification binary expression operator_. **/
	private binary_in_group(operator_node: ts.Node): boolean {
		if (!ts.isBinaryExpression(operator_node)) {
			return false;
		}
		return this._operator_kinds.has(operator_node.operatorToken.kind);
	}

	/** Responsibilities: _classification binary expression parent_. **/
	private parent_group(binary_expression: ts.BinaryExpression): boolean {
		if (ts.isParenthesizedExpression(binary_expression.parent)) {
			return false;
		}
		return this.binary_in_group(binary_expression.parent);
	}

	/** Responsibilities: _collection binary operators expression_. **/
	private append_binary_operators(
		operator_expression: ts.Expression,
		operators: Set<ts.SyntaxKind>,
		root_parenthesized = false,
	): void {
		if (ts.isParenthesizedExpression(operator_expression) && !root_parenthesized) {
			return;
		}
		this.append_boolean_operators(operator_expression, operators);
	}

	/** Responsibilities: _collection boolean operators expression_. **/
	private append_boolean_operators(boolean_expression: ts.Expression, operators: Set<ts.SyntaxKind>): void {
		if (ts.isPrefixUnaryExpression(boolean_expression)) {
			if (boolean_expression.operator === ts.SyntaxKind.ExclamationToken) {
				operators.add(boolean_expression.operator);
			}
			return;
		}
		if (!ts.isBinaryExpression(boolean_expression)) {
			return;
		}
		if (!this._operator_kinds.has(boolean_expression.operatorToken.kind)) {
			return;
		}
		operators.add(boolean_expression.operatorToken.kind);
		this.append_binary_operators(boolean_expression.left, operators);
		this.append_binary_operators(boolean_expression.right, operators);
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
	private mixed_group(root_candidate: ts.Node): boolean {
		if (!ts.isBinaryExpression(root_candidate)) {
			return false;
		}
		if (!this._operator_kinds.has(root_candidate.operatorToken.kind)) {
			return false;
		}
		if (this.parent_group(root_candidate)) {
			return false;
		}
		return this.mixed_operators(root_candidate);
	}

	/** Responsibilities: _precedence group operator count_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor() {
		this._operator_kinds = new Set([
			ts.SyntaxKind.AmpersandAmpersandToken,
			ts.SyntaxKind.BarBarToken,
			ts.SyntaxKind.ExclamationToken,
		]);
		this._comparison_kinds = new Set([
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
		this._boolean_boundary = new TypeScriptBooleanPrecedenceBoundary(this._operator_kinds, this._comparison_kinds);
	}
	/** Responsibilities: _public operation_. **/
	public boolean_operator_count(counted_expression: ts.Expression): number {
		if (ts.isParenthesizedExpression(counted_expression)) {
			return 0;
		}
		if (ts.isBinaryExpression(counted_expression)) {
			if (!this._operator_kinds.has(counted_expression.operatorToken.kind)) {
				return 0;
			}
			const left_operator_count = this.boolean_operator_count(counted_expression.left);
			const right_operator_count = this.boolean_operator_count(counted_expression.right);
			return 1 + left_operator_count + right_operator_count;
		}
		if (ts.isPrefixUnaryExpression(counted_expression)) {
			if (counted_expression.operator === ts.SyntaxKind.ExclamationToken) {
				return this.boolean_operator_count(counted_expression.operand);
			}
		}
		return 0;
	}

	/** Responsibilities: _reporting mixed boolean arithmetic_. **/
	public mixed_boolean_operator(reported_candidate: ts.Node): boolean {
		if (this._boolean_boundary.negation_comparison_boundary(reported_candidate)) {
			return true;
		}
		if (!ts.isBinaryExpression(reported_candidate)) {
			return false;
		}
		if (!this._boolean_boundary.boolean_operator(reported_candidate)) {
			return false;
		}
		if (this.parent_group(reported_candidate)) {
			return false;
		}
		if (this.mixed_group(reported_candidate)) {
			return true;
		}
		return false;
	}
}
