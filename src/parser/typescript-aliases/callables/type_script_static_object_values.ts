import { TypeScriptStaticObjectPropertySearch } from "src/parser/typescript-aliases/callables/type_script_static_object_property_search";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { CallableStaticObjectValueAppender } from "src/runtime_types";
import type {
	TypeScriptStaticObjectPropertySearchOptions,
	TypeScriptStaticObjectValuesContract,
} from "src/typescript_analysis_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _object property value collection_, _aliased property value resolution_. **/
export class TypeScriptStaticObjectValues implements TypeScriptStaticObjectValuesContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly _literal_kinds: Set<ts.SyntaxKind>;
	private readonly _values: Map<string, string>;
	private readonly _objects: Map<string, ts.ObjectLiteralExpression>;

	/** Responsibilities: _computed object property name_. **/
	private computed_property_name(node: ts.ComputedPropertyName): string {
		const static_name = this._expression_names.static_property_name(node);
		if (static_name !== "") {
			return static_name;
		}
		const current = this._expression_aliases.unwrapped(node.expression);
		if (!ts.isIdentifier(current)) {
			return "";
		}
		const value = this._values.get(current.text);
		if (value === undefined) {
			return "";
		}
		return value;
	}

	/** Responsibilities: _object value state_. **/
	public constructor(values: Map<string, string>, objects: Map<string, ts.ObjectLiteralExpression>) {
		this._expression_names = new TypeScriptExpressionNames();
		this._expression_aliases = new TypeScriptExpressionAliases("", new TypeScriptObjectAliasDeclarationIndex());
		this._literal_kinds = new Set([
			ts.SyntaxKind.StringLiteral,
			ts.SyntaxKind.NoSubstitutionTemplateLiteral,
			ts.SyntaxKind.NumericLiteral,
		]);
		this._values = values;
		this._objects = objects;
	}

	/** Responsibilities: _object property name_. **/
	public property_name(node: ts.Node): string {
		if (ts.isComputedPropertyName(node)) {
			return this.computed_property_name(node);
		}
		return this._expression_names.static_property_name(node);
	}

	/** Responsibilities: _object property value addition_. **/
	public append_property_value(
		initializer: ts.ObjectLiteralExpression,
		source_name: string,
		seen: Set<ts.ObjectLiteralExpression>,
		append_value: CallableStaticObjectValueAppender,
	): boolean {
		const options: TypeScriptStaticObjectPropertySearchOptions = {
			value_resolver: this,
			objects: this._objects,
			source_name,
			seen,
			append_value,
		};
		const search = new TypeScriptStaticObjectPropertySearch(options);
		return search.append(initializer);
	}

	/** Responsibilities: _object value addition_. **/
	public append_value(name: string, current: ts.Expression): boolean {
		if (this._values.has(name)) {
			return false;
		}
		if (this._literal_kinds.has(current.kind)) {
			this._values.set(name, this._expression_names.static_property_name(current));
			return true;
		}
		if (!ts.isIdentifier(current)) {
			return false;
		}
		const value = this._values.get(current.text);
		if (value === undefined) {
			return false;
		}
		this._values.set(name, value);
		return true;
	}

	/** Responsibilities: _object alias addition_. **/
	public append_object(name: string, current: ts.Expression): boolean {
		const value = this._expression_aliases.unwrapped(current);
		const is_literal = ts.isObjectLiteralExpression(value);
		const is_alias = ts.isIdentifier(value);
		if (this._objects.has(name) || (!is_literal && !is_alias)) {
			return false;
		}
		if (is_literal) {
			this._objects.set(name, value);
			return true;
		}
		const object = this._objects.get(value.text);
		if (object === undefined) {
			return false;
		}
		this._objects.set(name, object);
		return true;
	}

	/** Responsibilities: _object property value resolution_. **/
	public property_value(object: ts.ObjectLiteralExpression, source_name: string): string {
		let result = "";
		this.append_property_value(object, source_name, new Set(), (current) => {
			const value = this._expression_aliases.unwrapped(current);
			if (this._literal_kinds.has(value.kind)) {
				result = this._expression_names.static_property_name(value);
				return result !== "";
			}
			if (ts.isIdentifier(value)) {
				const aliased = this._values.get(value.text);
				if (aliased !== undefined) {
					result = aliased;
					return true;
				}
			}
			return false;
		});
		return result;
	}
}
