import ts from 'typescript';

/** Responsibilities: _callable feature checks identification_, _function comparisons classification_. **/
export class TypeScriptCallableFeatureDetection {
	private readonly comparison_operators = new Set([
		ts.SyntaxKind.EqualsEqualsToken,
		ts.SyntaxKind.EqualsEqualsEqualsToken,
		ts.SyntaxKind.ExclamationEqualsToken,
		ts.SyntaxKind.ExclamationEqualsEqualsToken,
	]);

	/** Responsibilities: _identification project-owned typeof function_. **/
	private project_function_check(typeof_expression: ts.TypeOfExpression, function_literal: ts.StringLiteral): boolean {
		if (function_literal.text !== 'function') {
			return false;
		}
		return ts.isPropertyAccessExpression(typeof_expression.expression);
	}

	/** Responsibilities: _callable feature-detection statements identification_. **/
	public feature_detection(node: ts.IfStatement): boolean {
		if (!ts.isBinaryExpression(node.expression)) {
			return false;
		}
		if (!this.comparison_operators.has(node.expression.operatorToken.kind)) {
			return false;
		}
		return this.function_comparison(node.expression.left, node.expression.right);
	}

	/** Responsibilities: _typeof-function comparisons identification_. **/
	public function_comparison(left: ts.Expression, right: ts.Expression): boolean {
		if (ts.isTypeOfExpression(left) && ts.isStringLiteral(right)) {
			return this.project_function_check(left, right);
		}
		if (ts.isTypeOfExpression(right) && ts.isStringLiteral(left)) {
			return this.project_function_check(right, left);
		}
		return false;
	}
}
