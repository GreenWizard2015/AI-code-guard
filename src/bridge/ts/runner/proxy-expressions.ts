import ts from "typescript";
import { TypeScriptStaticExpressionValues } from "src/typescript-callable-aliases/typescript-static-expression-values";

/** Responsibilities: _TypeScript proxy expression analysis_. **/
export class TypeScriptProxyExpressions {
	private readonly static_expression_values = new TypeScriptStaticExpressionValues();

	/** Responsibilities: _transparent expression classification_. **/
	private is_transparent_expression(node: ts.Node): boolean {
		if (ts.isParenthesizedExpression(node)) {
			return true;
		}
		if (ts.isNonNullExpression(node)) {
			return true;
		}
		if (ts.isAsExpression(node)) {
			return true;
		}
		if (ts.isTypeAssertionExpression(node)) {
			return true;
		}
		return ts.isSatisfiesExpression(node);
	}

	/** Responsibilities: _transparent expression unwrapping_. **/
	private transparent_expression(node: ts.Node): ts.Expression {
		if (ts.isParenthesizedExpression(node)) {
			return node.expression;
		}
		if (ts.isNonNullExpression(node)) {
			return node.expression;
		}
		if (ts.isAsExpression(node)) {
			return node.expression;
		}
		if (ts.isTypeAssertionExpression(node)) {
			return node.expression;
		}
		if (ts.isSatisfiesExpression(node)) {
			return node.expression;
		}
		throw new Error("Node is not a transparent expression.");
	}

	/** Responsibilities: _element property chain_. **/
	private element_property_chain(node: ts.ElementAccessExpression): string[] {
		const argument = node.argumentExpression;
		if (argument === undefined) {
			return [];
		}
		const property_name = this.static_expression_values.value(argument, node);
		if (property_name === "") {
			return [];
		}
		const chain = this.property_chain(node.expression);
		chain.push(property_name);
		return chain;
	}

	/** Responsibilities: _named property chain_. **/
	private named_property_chain(node: ts.PropertyAccessExpression): string[] {
		const chain = this.property_chain(node.expression);
		chain.push(node.name.text);
		return chain;
	}

	/** Responsibilities: _property chain collection_. **/
	public property_chain(node: ts.Node): string[] {
		if (this.is_transparent_expression(node)) {
			return this.property_chain(this.transparent_expression(node));
		}
		if (ts.isIdentifier(node)) {
			return [node.text];
		}
		if (ts.isElementAccessExpression(node)) {
			return this.element_property_chain(node);
		}
		if (ts.isPropertyAccessExpression(node)) {
			return this.named_property_chain(node);
		}
		return [];
	}

	/** Responsibilities: _property chain membership_. **/
	public contains_property(node: ts.Node, property: string): boolean {
		return this.property_chain(node).includes(property);
	}
}
