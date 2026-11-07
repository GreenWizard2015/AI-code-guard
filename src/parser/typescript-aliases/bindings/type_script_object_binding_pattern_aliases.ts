import { TypeScriptBindingAliasApplication } from "src/parser/typescript-aliases/bindings/type_script_binding_alias_application";
import { TypeScriptObjectBindingElementAliases } from "src/parser/typescript-aliases/bindings/type_script_object_binding_element_aliases";
import type {
	BindingAliasTraversalContract,
	BindingPropertyNameResolverContract,
} from "src/parser/typescript-aliases/protocols";
import type { BindingAliasesContract } from "src/runtime_protocols";
import type { CallableAliasAppender, CallableExpressionNormalizer } from "src/runtime_types";
import type ts from "typescript";

/** Responsibilities: _object pattern state_, _object binding alias traversal_. **/
export class TypeScriptObjectBindingPatternAliases implements BindingAliasTraversalContract {
	private readonly _binding: ts.ObjectBindingPattern;
	private readonly _initializer: ts.ObjectLiteralExpression;
	private readonly _property_names: BindingPropertyNameResolverContract;
	private readonly _binding_aliases: BindingAliasesContract;

	/** Responsibilities: _object binding pattern initialization_. **/
	public constructor(
		binding: ts.ObjectBindingPattern,
		initializer: ts.ObjectLiteralExpression,
		property_names: BindingPropertyNameResolverContract,
		binding_aliases: BindingAliasesContract,
	) {
		this._binding = binding;
		this._initializer = initializer;
		this._property_names = property_names;
		this._binding_aliases = binding_aliases;
	}

	/** Responsibilities: _object binding alias traversal_. **/
	public append(
		aliases: Set<string>,
		normalize_initializer: CallableExpressionNormalizer,
		append_alias: CallableAliasAppender,
	): boolean {
		const application = new TypeScriptBindingAliasApplication(
			aliases,
			normalize_initializer,
			append_alias,
			this._binding_aliases,
		);
		let changed = false;
		for (const element of this._binding.elements) {
			if (element.dotDotDotToken) {
				continue;
			}
			const element_aliases = new TypeScriptObjectBindingElementAliases(element, this._binding, this._property_names);
			if (application.append_all(element_aliases.targets(this._initializer))) {
				changed = true;
			}
		}
		return changed;
	}
}
