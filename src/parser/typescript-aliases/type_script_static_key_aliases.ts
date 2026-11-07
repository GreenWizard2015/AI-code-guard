import { TypeScriptStaticKeyState } from "src/parser/typescript-aliases/callables/type_script_static_key_state";
import { TypeScriptStaticObjectValues } from "src/parser/typescript-aliases/callables/type_script_static_object_values";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import type {
	TypeScriptExpressionAliasesContract,
	TypeScriptStaticKeyAliasesContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _static key alias lookup_, _object property value resolution_. **/
export class TypeScriptStaticKeyAliases implements TypeScriptStaticKeyAliasesContract {
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;

	/** Responsibilities: _static object property lookup_. **/
	private object_property_value(object: ts.Expression, property_name: string, scopes: readonly ts.Node[]): string {
		const object_expression = this._expression_aliases.unwrapped(object);
		if (!ts.isIdentifier(object_expression)) {
			return "";
		}
		for (const scope of scopes) {
			const scope_state = new TypeScriptStaticKeyState(scope);
			const state = scope_state.collect();
			const source = state.objects.get(object_expression.text);
			if (source === undefined) {
				continue;
			}
			const value_resolver = new TypeScriptStaticObjectValues(state.values, state.objects);
			return value_resolver.property_value(source, property_name);
		}
		return "";
	}

	/** Responsibilities: _visible static key values_. **/
	private visible_values(scope_reference: ts.Node): ReadonlyMap<string, string> {
		const values = new Map<string, string>();
		let scope = scope_reference;
		while (!ts.isSourceFile(scope)) {
			if (ts.isFunctionLike(scope)) {
				const state = new TypeScriptStaticKeyState(scope);
				for (const [name, value] of state.values()) {
					values.set(name, value);
				}
			}
			scope = scope.parent;
		}
		const source_state = new TypeScriptStaticKeyState(scope);
		for (const [name, value] of source_state.values()) {
			values.set(name, value);
		}
		return values;
	}

	/** Responsibilities: _visible lexical scope chain_. **/
	private visible_scopes(scope_reference: ts.Node): ts.Node[] {
		const scopes: ts.Node[] = [];
		let scope = scope_reference;
		while (!ts.isSourceFile(scope)) {
			if (ts.isFunctionLike(scope)) {
				scopes.push(scope);
			}
			scope = scope.parent;
		}
		scopes.push(scope);
		return scopes;
	}

	/** Responsibilities: _static key alias composition_. **/
	public constructor() {
		this._expression_aliases = new TypeScriptExpressionAliases("", new TypeScriptObjectAliasDeclarationIndex());
	}

	/** Responsibilities: _static key alias resolution_. **/
	public value(expression: ts.Expression, lookup_location: ts.Node): string {
		const current = this._expression_aliases.unwrapped(expression);
		if (!ts.isIdentifier(current)) {
			return "";
		}
		const value = this.visible_values(lookup_location).get(current.text);
		if (value === undefined) {
			return "";
		}
		return value;
	}

	/** Responsibilities: _static object property resolution_. **/
	public object_property(expression: ts.Expression, lookup_location: ts.Node): string {
		const current = this._expression_aliases.unwrapped(expression);
		const scopes = this.visible_scopes(lookup_location);
		if (ts.isPropertyAccessExpression(current)) {
			return this.object_property_value(current.expression, current.name.text, scopes);
		}
		if (!ts.isElementAccessExpression(current) || current.argumentExpression === undefined) {
			return "";
		}
		const property_name = this.value(current.argumentExpression, lookup_location);
		return this.object_property_value(current.expression, property_name, scopes);
	}
}
