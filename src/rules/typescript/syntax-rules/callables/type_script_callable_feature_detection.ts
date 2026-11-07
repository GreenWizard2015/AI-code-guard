import { METRIC_KIND_FUNCTION } from "src/metrics/constants";
import { TypeScriptConditionExpression } from "src/parser/internals/type_script_condition_expression";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptMemberAliases } from "src/parser/typescript-aliases/type_script_member_aliases";
import { TypeScriptStaticExpressionOperations } from "src/parser/typescript-aliases/type_script_static_expression_operations";
import { TypeScriptStaticExpressionValues } from "src/parser/typescript-aliases/type_script_static_expression_values";
import type { StaticExpressionValuesContract } from "src/shared_services_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptMemberAliasesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _callable feature checks identification_, _function comparisons classification_. **/
export class TypeScriptCallableFeatureDetection {
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly _static_expression_values: StaticExpressionValuesContract;
	private readonly _condition_expression: TypeScriptConditionExpression;
	private readonly _member_aliases: TypeScriptMemberAliasesContract;
	private readonly _comparison_operators: Set<ts.SyntaxKind>;

	/** Responsibilities: _static member name resolution_. **/
	private member_name(expression: ts.Expression, node: ts.Node): string {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text;
		}
		if (!ts.isElementAccessExpression(expression)) {
			return "";
		}
		if (expression.argumentExpression === undefined) {
			return "";
		}
		return this._static_expression_values.value(expression.argumentExpression, node);
	}

	/** Responsibilities: _identification project-owned typeof function_. **/
	private project_function_check(typeof_expression: ts.TypeOfExpression, function_name: string): boolean {
		if (function_name !== METRIC_KIND_FUNCTION) {
			return false;
		}
		const expression = this._expression_aliases.unwrapped(typeof_expression.expression);
		if (ts.isPropertyAccessExpression(expression)) {
			return true;
		}
		if (ts.isElementAccessExpression(expression)) {
			return this.member_name(expression, typeof_expression).length > 0;
		}
		if (ts.isIdentifier(expression)) {
			return this._member_aliases.member({ expression, node: typeof_expression });
		}
		return false;
	}

	/** Responsibilities: _callable feature-detection condition traversal_. **/
	private callable_check(expression: ts.Expression): boolean {
		const current = this._condition_expression.unwrap(expression);
		if (ts.isBinaryExpression(current)) {
			if (this._comparison_operators.has(current.operatorToken.kind)) {
				if (this.function_comparison(current.left, current.right)) {
					return true;
				}
			}
		}
		let found = false;
		current.forEachChild((child) => {
			if (found || !ts.isExpression(child)) {
				return;
			}
			found = this.callable_check(child);
		});
		return found;
	}

	/** Responsibilities: _callable feature-detection conditions identification_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor(declaration_index: TypeScriptObjectAliasDeclarationIndexContract) {
		this._expression_aliases = new TypeScriptExpressionAliases("", declaration_index);
		this._static_expression_values = new TypeScriptStaticExpressionValues(new TypeScriptStaticExpressionOperations());
		this._condition_expression = new TypeScriptConditionExpression();
		this._member_aliases = new TypeScriptMemberAliases(
			"*",
			(expression, node) => this._static_expression_values.value(expression, node),
			declaration_index,
		);
		this._comparison_operators = new Set([
			ts.SyntaxKind.EqualsEqualsToken,
			ts.SyntaxKind.EqualsEqualsEqualsToken,
			ts.SyntaxKind.ExclamationEqualsToken,
			ts.SyntaxKind.ExclamationEqualsEqualsToken,
		]);
	}
	/** Responsibilities: _public operation_. **/
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
			return this.project_function_check(left, this._static_expression_values.value(right, left));
		}
		if (ts.isTypeOfExpression(right)) {
			return this.project_function_check(right, this._static_expression_values.value(left, right));
		}
		return false;
	}
}
