import ts from 'typescript';

/** Responsibilities: _transparent expression child access_. **/
function transparent_expression_child(expression: ts.Expression): ts.Expression {
	if (ts.isParenthesizedExpression(expression)) {
		return expression.expression;
	}
	if (ts.isNonNullExpression(expression)) {
		return expression.expression;
	}
	if (ts.isAsExpression(expression)) {
		return expression.expression;
	}
	if (ts.isTypeAssertionExpression(expression)) {
		return expression.expression;
	}
	if (ts.isSatisfiesExpression(expression)) {
		return expression.expression;
	}
	return expression;
}

/** Responsibilities: _transparent expression unwrapping_. **/
export function unwrap_transparent_expression(expression: ts.Expression): ts.Expression {
	let child = transparent_expression_child(expression);
	while (child !== expression) {
		expression = child;
		child = transparent_expression_child(expression);
	}
	return expression;
}

/** Responsibilities: _static property names_. **/
export function static_property_name(node: ts.Node): string {
	if (ts.isComputedPropertyName(node)) {
		const expression = unwrap_transparent_expression(node.expression);
		if (ts.isStringLiteral(expression) || ts.isNumericLiteral(expression)) {
			return expression.text;
		}
		if (ts.isNoSubstitutionTemplateLiteral(expression)) {
			return expression.text;
		}
		return '';
	}
	if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
		return node.text;
	}
	if (ts.isNoSubstitutionTemplateLiteral(node)) {
		return node.text;
	}
	return '';
}

/** Responsibilities: _static binding names_. **/
export function static_binding_name(element: ts.BindingElement): string {
	if (element.propertyName !== undefined) {
		const property_name = static_property_name(element.propertyName);
		if (property_name !== '') {
			return property_name;
		}
	}
	return static_property_name(element.name);
}

/** Responsibilities: _static element names_. **/
export function static_element_name(element: ts.ObjectLiteralElementLike): string {
	if (element.name === undefined) {
		return '';
	}
	return static_property_name(element.name);
}
