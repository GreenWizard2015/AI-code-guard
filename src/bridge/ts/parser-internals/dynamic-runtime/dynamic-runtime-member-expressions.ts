import ts from "typescript";
import { TypeScriptStaticExpressionValues } from "src/typescript-callable-aliases/typescript-static-expression-values";

/** Responsibilities: _dynamic runtime member expressions_. **/
export class DynamicRuntimeMemberExpressions {
	private readonly static_expression_values = new TypeScriptStaticExpressionValues();

	/** Responsibilities: _runtime owner name_. **/
	/** Responsibilities: _static element member_. **/
	private static_element_member(expression: ts.Expression): boolean {
		if (!ts.isElementAccessExpression(expression)) {
			return false;
		}
		const argument = expression.argumentExpression;
		if (argument === undefined) {
			return false;
		}
		return this.static_expression_values.value(argument, expression).length > 0;
	}

	/** Responsibilities: _runtime member name_. **/
	public member_name(expression: ts.Expression): string {
		if (ts.isIdentifier(expression)) {
			return expression.text;
		}
		if (!ts.isPropertyAccessExpression(expression)) {
			return "";
		}
		if (!ts.isIdentifier(expression.expression)) {
			return "";
		}
		return expression.name.text;
	}

	/** Responsibilities: _dynamic member owners_. **/
	public member_owners(expression: ts.Expression): readonly ts.Expression[] {
		if (ts.isPropertyAccessExpression(expression)) {
			return [expression.expression];
		}
		if (ts.isElementAccessExpression(expression) && this.static_element_member(expression)) {
			return [expression.expression];
		}
		return [];
	}
}
