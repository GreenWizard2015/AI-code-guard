import { TypeScriptStaticExpressionOperations } from "src/parser/typescript-aliases/type_script_static_expression_operations";
import { TypeScriptStaticExpressionValues } from "src/parser/typescript-aliases/type_script_static_expression_values";
import type { StaticExpressionValuesContract } from "src/shared_services_protocols";
import type { TypeScriptProxyExpressionsContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _property chain extraction_, _transparent expression unwrapping_. **/
export class TypeScriptProxyExpressions implements TypeScriptProxyExpressionsContract {
	private readonly _static_expression_values: StaticExpressionValuesContract;

	/** Responsibilities: _transparent expression classification_. **/
	private is_transparent_expression(expression_candidate: ts.Node): boolean {
		if (ts.isParenthesizedExpression(expression_candidate)) {
			return true;
		}
		if (ts.isNonNullExpression(expression_candidate)) {
			return true;
		}
		if (ts.isAsExpression(expression_candidate)) {
			return true;
		}
		if (ts.isTypeAssertionExpression(expression_candidate)) {
			return true;
		}
		return ts.isSatisfiesExpression(expression_candidate);
	}

	/** Responsibilities: _transparent expression unwrapping_. **/
	private transparent_expression(transparent_expression_node: ts.Node): ts.Expression {
		if (ts.isParenthesizedExpression(transparent_expression_node)) {
			return transparent_expression_node.expression;
		}
		if (ts.isNonNullExpression(transparent_expression_node)) {
			return transparent_expression_node.expression;
		}
		if (ts.isAsExpression(transparent_expression_node)) {
			return transparent_expression_node.expression;
		}
		if (ts.isTypeAssertionExpression(transparent_expression_node)) {
			return transparent_expression_node.expression;
		}
		if (ts.isSatisfiesExpression(transparent_expression_node)) {
			return transparent_expression_node.expression;
		}
		throw new Error("Node is not a transparent expression.");
	}

	/** Responsibilities: _element property chain_. **/
	private element_property_chain(element_access: ts.ElementAccessExpression): string[] {
		const argument = element_access.argumentExpression;
		if (argument === undefined) {
			return [];
		}
		const property_name = this._static_expression_values.value(argument, element_access);
		if (property_name === "") {
			return [];
		}
		const chain = this.property_chain(element_access.expression);
		chain.push(property_name);
		return chain;
	}

	/** Responsibilities: _named property chain_. **/
	private named_property_chain(property_access: ts.PropertyAccessExpression): string[] {
		const chain = this.property_chain(property_access.expression);
		chain.push(property_access.name.text);
		return chain;
	}

	/** Responsibilities: _property chain collection_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor() {
		this._static_expression_values = new TypeScriptStaticExpressionValues(new TypeScriptStaticExpressionOperations());
	}
	/** Responsibilities: _public operation_. **/
	public property_chain(property_candidate: ts.Node): string[] {
		if (this.is_transparent_expression(property_candidate)) {
			return this.property_chain(this.transparent_expression(property_candidate));
		}
		if (ts.isIdentifier(property_candidate)) {
			return [property_candidate.text];
		}
		if (ts.isElementAccessExpression(property_candidate)) {
			return this.element_property_chain(property_candidate);
		}
		if (ts.isPropertyAccessExpression(property_candidate)) {
			return this.named_property_chain(property_candidate);
		}
		return [];
	}

	/** Responsibilities: _property chain membership_. **/
	public contains_property(property_owner: ts.Node, property: string): boolean {
		return this.property_chain(property_owner).includes(property);
	}
}
