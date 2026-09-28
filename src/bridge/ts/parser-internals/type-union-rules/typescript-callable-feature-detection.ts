import ts from 'typescript';
import { TypeScriptExpressionAliases } from 'src/typescript-aliases/typescript-expression-aliases';
import { TypeScriptMemberAliases } from 'src/typescript-aliases/typescript-member-aliases';
import { TypeScriptStaticExpressionValues } from 'src/typescript-callable-aliases/typescript-static-expression-values';
import { TypeScriptConditionExpression } from 'src/bridge/ts/parser-internals/typescript-condition-expression';

/** Responsibilities: _callable feature checks identification_, _function comparisons classification_. **/
export class TypeScriptCallableFeatureDetection {
	private readonly expression_aliases = new TypeScriptExpressionAliases('');
	private readonly static_expression_values = new TypeScriptStaticExpressionValues();
	private readonly condition_expression = new TypeScriptConditionExpression();
	private readonly member_aliases = new TypeScriptMemberAliases(
		'*',
		(expression, node) => this.static_expression_values.value(expression, node)
	);
	private readonly comparison_operators = new Set([
		ts.SyntaxKind.EqualsEqualsToken,
		ts.SyntaxKind.EqualsEqualsEqualsToken,
		ts.SyntaxKind.ExclamationEqualsToken,
		ts.SyntaxKind.ExclamationEqualsEqualsToken,
	]);

	/** Responsibilities: _static member name resolution_. **/
	private member_name(expression: ts.Expression, node: ts.Node): string {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text;
		}
		if (!ts.isElementAccessExpression(expression) || expression.argumentExpression === undefined) {
			return '';
		}
		return this.static_expression_values.value(expression.argumentExpression, node);
	}

	/** Responsibilities: _identification project-owned typeof function_. **/
	private project_function_check(typeof_expression: ts.TypeOfExpression, function_name: string): boolean {
		if (function_name !== 'function') {
			return false;
		}
		const expression = this.expression_aliases.unwrapped(typeof_expression.expression);
		if (ts.isPropertyAccessExpression(expression)) {
			return true;
		}
		if (ts.isElementAccessExpression(expression)) {
			return this.member_name(expression, typeof_expression).length > 0;
		}
		if (ts.isIdentifier(expression)) {
			return this.member_aliases.member(expression, typeof_expression);
		}
		return false;
	}

	/** Responsibilities: _callable feature-detection condition traversal_. **/
	private callable_check(expression: ts.Expression): boolean {
		const current = this.condition_expression.unwrap(expression);
		if (ts.isBinaryExpression(current)) {
			if (this.comparison_operators.has(current.operatorToken.kind)) {
				if (this.function_comparison(current.left, current.right)) {
					return true;
				}
			}
		}
		let found = false;
		current.forEachChild(child => {
			if (found || !ts.isExpression(child)) {
				return;
			}
			found = this.callable_check(child);
		});
		return found;
	}

	/** Responsibilities: _callable feature-detection conditions identification_. **/
	public feature_detection(node: ts.Node): boolean {
		let condition: ts.Expression | undefined;
		if (ts.isIfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)) {
			condition = node.expression;
		} else if (ts.isForStatement(node)) {
			condition = node.condition;
		} else if (ts.isConditionalExpression(node)) {
			condition = node.condition;
		}
		if (condition === undefined) {
			return false;
		}
		return this.callable_check(condition);
	}

	/** Responsibilities: _typeof-function comparisons identification_. **/
	public function_comparison(left: ts.Expression, right: ts.Expression): boolean {
		if (ts.isTypeOfExpression(left)) {
			return this.project_function_check(left, this.static_expression_values.value(right, left));
		}
		if (ts.isTypeOfExpression(right)) {
			return this.project_function_check(right, this.static_expression_values.value(left, right));
		}
		return false;
	}
}
