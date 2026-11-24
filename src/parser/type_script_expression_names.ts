import type { ExpressionNamesContract } from "src/runtime_protocols";
import ts from "typescript";

/** Responsibilities: _transparent expression unwrapping_, _static binding name extraction_. **/
export class TypeScriptExpressionNames implements ExpressionNamesContract {
	private readonly _unwrapped_expressions: WeakMap<ts.Expression, ts.Expression>;
	private readonly _static_names: WeakMap<ts.Node, string>;

	/** Responsibilities: _transparent expression child access_. **/
	private runtime_wrapper_child(runtime_candidate: ts.Expression): ts.Expression {
		if (ts.isParenthesizedExpression(runtime_candidate)) {
			return runtime_candidate.expression;
		}
		if (ts.isNonNullExpression(runtime_candidate)) {
			return runtime_candidate.expression;
		}
		if (ts.isAwaitExpression(runtime_candidate)) {
			return runtime_candidate.expression;
		}
		return runtime_candidate;
	}

	/** Responsibilities: _type assertion wrapper child_. **/
	private assertion_wrapper_child(assertion_candidate: ts.Expression): ts.Expression {
		if (ts.isAsExpression(assertion_candidate)) {
			return assertion_candidate.expression;
		}
		if (ts.isTypeAssertionExpression(assertion_candidate)) {
			return assertion_candidate.expression;
		}
		if (ts.isSatisfiesExpression(assertion_candidate)) {
			return assertion_candidate.expression;
		}
		return assertion_candidate;
	}

	/** Responsibilities: _transparent expression child lookup_. **/
	private transparent_child(wrapped_candidate: ts.Expression): ts.Expression {
		const assertion_child = this.assertion_wrapper_child(wrapped_candidate);
		if (assertion_child !== wrapped_candidate) {
			return assertion_child;
		}
		return this.runtime_wrapper_child(wrapped_candidate);
	}

	/** Responsibilities: _static property name resolution_. **/
	private resolve_property_name(node: ts.Node): string {
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

	/** Responsibilities: _expression identity cache ownership_. **/
	public constructor() {
		this._unwrapped_expressions = new WeakMap();
		this._static_names = new WeakMap();
	}

	/** Responsibilities: _transparent expression unwrapping_. **/
	public unwrap_transparent_expression(expression: ts.Expression): ts.Expression {
		const cached = this._unwrapped_expressions.get(expression);
		if (cached !== undefined) {
			return cached;
		}
		const original = expression;
		let current_expression = expression;
		let child = this.transparent_child(current_expression);
		while (child !== current_expression) {
			current_expression = child;
			child = this.transparent_child(current_expression);
		}
		this._unwrapped_expressions.set(original, current_expression);
		return current_expression;
	}

	/** Responsibilities: _static property names_. **/
	public static_property_name(node: ts.Node): string {
		const cached = this._static_names.get(node);
		if (cached !== undefined) {
			return cached;
		}
		const name = this.resolve_property_name(node);
		this._static_names.set(node, name);
		return name;
	}

	/** Responsibilities: _static binding names_. **/
	public static_binding_name(element: ts.BindingElement): string {
		const cached = this._static_names.get(element);
		if (cached !== undefined) {
			return cached;
		}
		let name = "";
		if (element.propertyName !== undefined) {
			name = this.static_property_name(element.propertyName);
			if (name !== "") {
				this._static_names.set(element, name);
				return name;
			}
		}
		name = this.static_property_name(element.name);
		this._static_names.set(element, name);
		return name;
	}

	/** Responsibilities: _static element names_. **/
	public static_element_name(element: ts.ObjectLiteralElementLike): string {
		const cached = this._static_names.get(element);
		if (cached !== undefined) {
			return cached;
		}
		if (element.name === undefined) {
			return "";
		}
		const name = this.static_property_name(element.name);
		this._static_names.set(element, name);
		return name;
	}
}
