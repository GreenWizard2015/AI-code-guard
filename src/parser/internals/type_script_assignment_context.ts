import type { BooleanExpressionContract } from "src/runtime_protocols";
import type { TypeScriptAssignmentContextContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _assignment context_, _assignment operator classification_. **/
export class TypeScriptAssignmentContext implements TypeScriptAssignmentContextContract {
	private readonly _boolean_expression: BooleanExpressionContract;
	private readonly _logical_assignment_kinds: Set<ts.SyntaxKind>;

	/** Responsibilities: _binary assignment boundary_. **/
	private binary_boundary(child: ts.Node, parent: ts.BinaryExpression): boolean {
		if (this._boolean_expression.logical_operator(parent)) {
			return true;
		}
		return parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && parent.right === child;
	}

	/** Responsibilities: _expression assignment boundary_. **/
	private assignment_boundary(child: ts.Node, boundary_node: ts.Node): boolean {
		if (ts.isBinaryExpression(boundary_node)) {
			return this.binary_boundary(child, boundary_node);
		}
		if (ts.isVariableDeclaration(boundary_node)) {
			return boundary_node.initializer === child;
		}
		if (ts.isBindingElement(boundary_node)) {
			return boundary_node.initializer === child;
		}
		if (ts.isParameter(boundary_node)) {
			return boundary_node.initializer === child;
		}
		return false;
	}

	/** Responsibilities: _invoked callable identification_. **/
	private is_invoked_callable(callable_expression: ts.Node): boolean {
		let invocation = callable_expression.parent;
		while (ts.isParenthesizedExpression(invocation)) {
			invocation = invocation.parent;
		}
		if (!ts.isCallExpression(invocation)) {
			return false;
		}
		let callee: ts.Expression = invocation.expression;
		while (ts.isParenthesizedExpression(callee)) {
			callee = callee.expression;
		}
		return callee === callable_expression;
	}

	/** Responsibilities: _assignment owner lookup_. **/
	private assignment_owner(expression: ts.BinaryExpression): ts.Node {
		let child: ts.Node = expression;
		let parent = expression.parent;
		while (!ts.isSourceFile(parent)) {
			if (ts.isFunctionLike(parent) && !this.is_invoked_callable(parent)) {
				return parent;
			}
			if (this.assignment_boundary(child, parent)) {
				return parent;
			}
			child = parent;
			parent = parent.parent;
		}
		return parent;
	}

	/** Responsibilities: _assigned value classification_. **/
	private is_assigned_value(expression: ts.BinaryExpression): boolean {
		const owner = this.assignment_owner(expression);
		if (ts.isVariableDeclaration(owner)) {
			return owner.initializer !== undefined;
		}
		if (ts.isBindingElement(owner)) {
			return owner.initializer !== undefined;
		}
		if (ts.isParameter(owner)) {
			return owner.initializer !== undefined;
		}
		return ts.isBinaryExpression(owner) && owner.operatorToken.kind === ts.SyntaxKind.EqualsToken;
	}

	/** Responsibilities: _assignment context initialization_. **/
	public constructor(boolean_expression: BooleanExpressionContract) {
		this._boolean_expression = boolean_expression;
		this._logical_assignment_kinds = new Set([
			ts.SyntaxKind.QuestionQuestionEqualsToken,
			ts.SyntaxKind.BarBarEqualsToken,
			ts.SyntaxKind.AmpersandAmpersandEqualsToken,
		]);
	}

	/** Responsibilities: _conditional assignment classification_. **/
	public conditional_assignment(node: ts.Node): boolean {
		return ts.isBinaryExpression(node) && this.is_assigned_value(node);
	}

	/** Responsibilities: _logical assignment classification_. **/
	public logical_assignment(node: ts.Node): boolean {
		return ts.isBinaryExpression(node) && this._logical_assignment_kinds.has(node.operatorToken.kind);
	}
}
