import ts from "typescript";
import type { ExpressionNamesContract } from "src/runtime_protocols";

/** Responsibilities: _transparent expression unwrapping_, _static binding name extraction_. **/
export class TypeScriptExpressionNames implements ExpressionNamesContract {
	/** Responsibilities: _parenthesized expression child access_. **/
	private parenthesized_child(expression: ts.Expression): ts.Expression {
		if (ts.isParenthesizedExpression(expression)) {
			return expression.expression;
		}
		return expression;
	}

	/** Responsibilities: _non-null expression child access_. **/
	private non_null_child(expression: ts.Expression): ts.Expression {
		if (ts.isNonNullExpression(expression)) {
			return expression.expression;
		}
		return expression;
	}

	/** Responsibilities: _assertion expression child_. **/
	private asserted_child(expression: ts.Expression): ts.Expression {
		if (ts.isAsExpression(expression)) {
			return expression.expression;
		}
		if (ts.isTypeAssertionExpression(expression)) {
			return expression.expression;
		}
		return expression;
	}

	/** Responsibilities: _satisfied expression child access_. **/
	private satisfied_child(expression: ts.Expression): ts.Expression {
		if (ts.isSatisfiesExpression(expression)) {
			return expression.expression;
		}
		return expression;
	}

	/** Responsibilities: _await expression child access_. **/
	private await_child(expression: ts.Expression): ts.Expression {
		if (ts.isAwaitExpression(expression)) {
			return expression.expression;
		}
		return expression;
	}

	/** Responsibilities: _transparent expression child access_. **/
	private transparent_expression_child(expression: ts.Expression): ts.Expression {
		if (ts.isParenthesizedExpression(expression)) {
			return this.parenthesized_child(expression);
		}
		if (ts.isNonNullExpression(expression)) {
			return this.non_null_child(expression);
		}
		if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
			return this.asserted_child(expression);
		}
		if (ts.isSatisfiesExpression(expression)) {
			return this.satisfied_child(expression);
		}
		if (ts.isAwaitExpression(expression)) {
			return this.await_child(expression);
		}
		return expression;
	}

	/** Responsibilities: _transparent expression unwrapping_. **/
	public unwrap_transparent_expression(expression: ts.Expression): ts.Expression {
		let child = this.transparent_expression_child(expression);
		while (child !== expression) {
			expression = child;
			child = this.transparent_expression_child(expression);
		}
		return expression;
	}

	/** Responsibilities: _static property names_. **/
	public static_property_name(node: ts.Node): string {
		if (ts.isComputedPropertyName(node)) {
			const expression = this.unwrap_transparent_expression(node.expression);
			if (ts.isStringLiteral(expression) || ts.isNumericLiteral(expression)) {
				return expression.text;
			}
			if (ts.isNoSubstitutionTemplateLiteral(expression)) {
				return expression.text;
			}
			return "";
		}
		if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
			return node.text;
		}
		if (ts.isNoSubstitutionTemplateLiteral(node)) {
			return node.text;
		}
		return "";
	}

	/** Responsibilities: _static binding names_. **/
	public static_binding_name(element: ts.BindingElement): string {
		if (element.propertyName !== undefined) {
			const property_name = this.static_property_name(element.propertyName);
			if (property_name !== "") {
				return property_name;
			}
		}
		return this.static_property_name(element.name);
	}

	/** Responsibilities: _static element names_. **/
	public static_element_name(element: ts.ObjectLiteralElementLike): string {
		if (element.name === undefined) {
			return "";
		}
		return this.static_property_name(element.name);
	}
}
