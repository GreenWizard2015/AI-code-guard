import ts from "typescript";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/typescript-expression-aliases";
import { TypeScriptStaticKeyState } from "src/typescript-callable-aliases/static-key/static-key-state";
import { TypeScriptStaticObjectValues } from "src/typescript-callable-aliases/static-object-values";

/** Responsibilities: _static key alias resolution_. **/
export class TypeScriptStaticKeyAliases {
	private readonly expression_aliases = new TypeScriptExpressionAliases("");
	private readonly state_collector = new TypeScriptStaticKeyState();

	/** Responsibilities: _static key scope lookup_. **/
	private scopes(node: ts.Node): ts.Node[] {
		const scopes: ts.Node[] = [];
		let current = node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				scopes.push(current);
			}
			current = current.parent;
		}
		scopes.push(current);
		return scopes;
	}

	/** Responsibilities: _static object property lookup_. **/
	private object_property_value(object: ts.Expression, property_name: string, node: ts.Node): string {
		const object_expression = this.expression_aliases.unwrapped(object);
		if (!ts.isIdentifier(object_expression)) {
			return "";
		}
		for (const scope of this.scopes(node)) {
			const state = this.state_collector.collect(scope);
			const source = state.objects.get(object_expression.text);
			if (source === undefined) {
				continue;
			}
			const value_resolver = new TypeScriptStaticObjectValues(state.values, state.objects);
			return value_resolver.property_value(source, property_name);
		}
		return "";
	}

	/** Responsibilities: _static key alias values_. **/
	public values(node: ts.Node): ReadonlyMap<string, string> {
		const values = new Map<string, string>();
		for (const scope of this.scopes(node)) {
			for (const [name, value] of this.state_collector.values(scope)) {
				values.set(name, value);
			}
		}
		return values;
	}

	/** Responsibilities: _static key alias resolution_. **/
	public value(expression: ts.Expression, node: ts.Node): string {
		const current = this.expression_aliases.unwrapped(expression);
		if (!ts.isIdentifier(current)) {
			return "";
		}
		const value = this.values(node).get(current.text);
		if (value === undefined) {
			return "";
		}
		return value;
	}

	/** Responsibilities: _static object property resolution_. **/
	public object_property(expression: ts.Expression, node: ts.Node): string {
		const current = this.expression_aliases.unwrapped(expression);
		if (ts.isPropertyAccessExpression(current)) {
			return this.object_property_value(current.expression, current.name.text, node);
		}
		if (!ts.isElementAccessExpression(current)) {
			return "";
		}
		if (current.argumentExpression === undefined) {
			return "";
		}
		const property_name = this.value(current.argumentExpression, node);
		return this.object_property_value(current.expression, property_name, node);
	}
}
