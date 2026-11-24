import { TypeScriptArrayBindingAliases } from "src/parser/typescript-aliases/bindings/type_script_array_binding_aliases";
import { TypeScriptObjectBindingPatternAliases } from "src/parser/typescript-aliases/bindings/type_script_object_binding_pattern_aliases";
import type { BindingPropertyNameResolverContract } from "src/parser/typescript-aliases/protocols";
import type { BindingAliasesContract, ExpressionNamesContract } from "src/runtime_protocols";
import type { CallableAliasAppender, CallableExpressionNormalizer } from "src/runtime_types";
import ts from "typescript";

/** Responsibilities: _binding name resolution_, _object alias traversal_, _array alias traversal_. **/
export class TypeScriptBindingAliases implements BindingAliasesContract, BindingPropertyNameResolverContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _property_names: WeakMap<ts.Node, string>;

	/** Responsibilities: _destructured property name_. **/
	private resolve_property_name(element: ts.Node): string {
		if (ts.isBindingElement(element)) {
			return this._expression_names.static_binding_name(element);
		}
		return this._expression_names.static_property_name(element);
	}

	/** Responsibilities: _binding alias dependencies setup_. **/
	public constructor(expression_names: ExpressionNamesContract) {
		this._property_names = new WeakMap<ts.Node, string>();
		this._expression_names = expression_names;
	}

	/** Responsibilities: _binding property resolution_. **/
	public property_name(element: ts.Node): string {
		const cached = this._property_names.get(element);
		if (cached !== undefined) {
			return cached;
		}
		const property_name = this.resolve_property_name(element);
		this._property_names.set(element, property_name);
		return property_name;
	}

	/** Responsibilities: _binding alias application_. **/
	public append_binding_aliases(
		aliases: Set<string>,
		binding: ts.BindingName,
		initializer: ts.Expression,
		normalize_initializer: CallableExpressionNormalizer,
		append_alias: CallableAliasAppender,
	): boolean {
		const value = normalize_initializer(initializer);
		if (ts.isIdentifier(binding)) {
			return append_alias(binding.text, value);
		}
		if (ts.isObjectBindingPattern(binding) && ts.isObjectLiteralExpression(value)) {
			const object_aliases = new TypeScriptObjectBindingPatternAliases(binding, value, this, this);
			return object_aliases.append(aliases, normalize_initializer, append_alias);
		}
		if (ts.isArrayBindingPattern(binding) && ts.isArrayLiteralExpression(value)) {
			const array_aliases = new TypeScriptArrayBindingAliases(binding, value, this);
			return array_aliases.append(aliases, normalize_initializer, append_alias);
		}
		return false;
	}
}
