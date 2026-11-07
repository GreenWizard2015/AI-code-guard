import type { BindingAliasTraversalContract } from "src/parser/typescript-aliases/protocols";
import type { BindingAliasesContract } from "src/runtime_protocols";
import type { CallableAliasAppender, CallableExpressionNormalizer } from "src/runtime_types";
import ts from "typescript";

/** Responsibilities: _array binding element state_, _array alias traversal_. **/
export class TypeScriptArrayBindingElementAliases implements BindingAliasTraversalContract {
	private readonly _binding: ts.BindingElement;
	private readonly _value: ts.Expression;
	private readonly _binding_aliases: BindingAliasesContract;

	/** Responsibilities: _array spread alias_. **/
	private append_spread_alias(
		aliases: Set<string>,
		normalize_initializer: CallableExpressionNormalizer,
		append_alias: CallableAliasAppender,
		spread_element: ts.SpreadElement,
	): boolean {
		const spread = normalize_initializer(spread_element.expression);
		if (!ts.isArrayLiteralExpression(spread)) {
			return false;
		}
		for (const first of spread.elements) {
			return this._binding_aliases.append_binding_aliases(
				aliases,
				this._binding.name,
				first,
				normalize_initializer,
				append_alias,
			);
		}
		return false;
	}

	/** Responsibilities: _array binding element initialization_. **/
	public constructor(binding: ts.BindingElement, value: ts.Expression, binding_aliases: BindingAliasesContract) {
		this._binding = binding;
		this._value = value;
		this._binding_aliases = binding_aliases;
	}

	/** Responsibilities: _array binding element aliases_. **/
	public append(
		aliases: Set<string>,
		normalize_initializer: CallableExpressionNormalizer,
		append_alias: CallableAliasAppender,
	): boolean {
		if (this._binding.dotDotDotToken || this._value.kind === ts.SyntaxKind.OmittedExpression) {
			return false;
		}
		if (!ts.isSpreadElement(this._value)) {
			return this._binding_aliases.append_binding_aliases(
				aliases,
				this._binding.name,
				this._value,
				normalize_initializer,
				append_alias,
			);
		}
		return this.append_spread_alias(aliases, normalize_initializer, append_alias, this._value);
	}
}
