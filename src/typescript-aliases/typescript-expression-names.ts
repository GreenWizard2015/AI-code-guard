import ts from "typescript";

/** Responsibilities: _TypeScript expression names_. **/
export class TypeScriptExpressionNames {
	private readonly transparent_expression_readers: ReadonlyMap<
		ts.SyntaxKind,
		(expression: ts.Expression) => ts.Expression
	>;

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

	/** Responsibilities: _transparent expression child access_. **/
	private transparent_expression_child(expression: ts.Expression): ts.Expression {
		const reader = this.transparent_expression_readers.get(expression.kind);
		if (reader === undefined) {
			return expression;
		}
		return reader(expression);
	}

	/** Responsibilities: _expression reader initialization_. **/
	constructor() {
		this.transparent_expression_readers = new Map([
			[ts.SyntaxKind.ParenthesizedExpression, (expression) => this.parenthesized_child(expression)],
			[ts.SyntaxKind.NonNullExpression, (expression) => this.non_null_child(expression)],
			[ts.SyntaxKind.AsExpression, (expression) => this.asserted_child(expression)],
			[ts.SyntaxKind.TypeAssertionExpression, (expression) => this.asserted_child(expression)],
			[ts.SyntaxKind.SatisfiesExpression, (expression) => this.satisfied_child(expression)],
		]);
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
