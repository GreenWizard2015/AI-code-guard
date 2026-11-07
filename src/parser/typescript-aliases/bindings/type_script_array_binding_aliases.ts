import { TypeScriptArrayBindingElementAliases } from "src/parser/typescript-aliases/bindings/type_script_array_binding_element_aliases";
import type { BindingAliasTraversalContract } from "src/parser/typescript-aliases/protocols";
import type { BindingAliasesContract } from "src/runtime_protocols";
import type { CallableAliasAppender, CallableExpressionNormalizer } from "src/runtime_types";
import ts from "typescript";

/** Responsibilities: _array pattern state_, _array binding alias traversal_. **/
export class TypeScriptArrayBindingAliases implements BindingAliasTraversalContract {
	private readonly _binding: ts.ArrayBindingPattern;
	private readonly _initializer: ts.ArrayLiteralExpression;
	private readonly _binding_aliases: BindingAliasesContract;

	/** Responsibilities: _array binding initialization_. **/
	public constructor(
		binding: ts.ArrayBindingPattern,
		initializer: ts.ArrayLiteralExpression,
		binding_aliases: BindingAliasesContract,
	) {
		this._binding = binding;
		this._initializer = initializer;
		this._binding_aliases = binding_aliases;
	}

	/** Responsibilities: _array binding alias traversal_. **/
	public append(
		aliases: Set<string>,
		normalize_initializer: CallableExpressionNormalizer,
		append_alias: CallableAliasAppender,
	): boolean {
		let changed = false;
		const values = this._initializer.elements[Symbol.iterator]();
		for (const element of this._binding.elements) {
			const value = values.next();
			if (value.done) {
				break;
			}
			if (!ts.isBindingElement(element)) {
				continue;
			}
			const alias = new TypeScriptArrayBindingElementAliases(element, value.value, this._binding_aliases);
			if (alias.append(aliases, normalize_initializer, append_alias)) {
				changed = true;
			}
		}
		return changed;
	}
}
