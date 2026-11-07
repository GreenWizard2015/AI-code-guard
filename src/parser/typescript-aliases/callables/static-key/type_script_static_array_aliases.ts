import type { StaticExpressionArrayContract } from "src/analysis_protocols";
import { StaticExpressionArray } from "src/parser/typescript-aliases/callables/static-array/static_expression_array";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _array source alias tracking_, _destructured element alias collection_. **/
export class TypeScriptStaticArrayAliases {
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _static_key_kinds: Set<ts.SyntaxKind>;
	private readonly _values: Map<string, string>;
	private readonly _arrays: Map<string, StaticExpressionArrayContract>;

	/** Responsibilities: _array value addition_. **/
	private append_value(name: string, initializer: ts.Expression): boolean {
		const current = this._expression_aliases.unwrapped(initializer);
		let value = "";
		if (this._static_key_kinds.has(current.kind)) {
			value = this._expression_names.static_property_name(current);
		} else if (ts.isIdentifier(current)) {
			const resolved_value = this._values.get(current.text);
			if (resolved_value !== undefined) {
				value = resolved_value;
			}
		}
		if (value.length === 0 || this._values.has(name)) {
			return false;
		}
		this._values.set(name, value);
		return true;
	}

	/** Responsibilities: _array spread elements_. **/
	private spread_sequence(element: ts.SpreadElement): StaticExpressionArrayContract {
		const current = this._expression_aliases.unwrapped(element.expression);
		if (ts.isArrayLiteralExpression(current)) {
			return this.normalized_elements(current.elements);
		}
		if (!ts.isIdentifier(current)) {
			return new StaticExpressionArray([], []);
		}
		const array = this._arrays.get(current.text);
		if (array === undefined) {
			return new StaticExpressionArray([], []);
		}
		return array;
	}

	/** Responsibilities: _array element collection_. **/
	private normalized_elements(initializer: readonly ts.Expression[]): StaticExpressionArrayContract {
		const parts: StaticExpressionArrayContract[] = [];
		for (const element of initializer) {
			if (ts.isSpreadElement(element)) {
				parts.push(this.spread_sequence(element));
				continue;
			}
			parts.push(new StaticExpressionArray([element], []));
		}
		return new StaticExpressionArray([], parts);
	}

	/** Responsibilities: _array destructured binding values_. **/
	private append_array_binding(binding: ts.ArrayBindingPattern, initializer: StaticExpressionArrayContract): boolean {
		let changed = false;
		for (let index = 0; index < binding.elements.length; index += 1) {
			const element = binding.elements[index];
			if (element === undefined || !ts.isBindingElement(element)) {
				continue;
			}
			if (this.append_element(element, initializer, index)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _array element binding_. **/
	private append_element(
		element: ts.BindingElement,
		initializer: StaticExpressionArrayContract,
		index: number,
	): boolean {
		if (element.dotDotDotToken) {
			if (!ts.isIdentifier(element.name) || this._arrays.has(element.name.text)) {
				return false;
			}
			this._arrays.set(element.name.text, initializer.slice(index));
			return true;
		}
		const offset = BigInt(index);
		if (!initializer.contains(offset) || !ts.isIdentifier(element.name)) {
			return false;
		}
		return this.append_value(element.name.text, initializer.at(offset));
	}

	/** Responsibilities: _named array source alias_. **/
	private append_named_source(name: string, current: ts.Expression): boolean {
		if (!ts.isIdentifier(current)) {
			return false;
		}
		const source = this._arrays.get(current.text);
		if (source === undefined) {
			return false;
		}
		this._arrays.set(name, source);
		return true;
	}

	/** Responsibilities: _named array destructuring source_. **/
	private append_binding_source(binding: ts.ArrayBindingPattern, current: ts.Expression): boolean {
		if (!ts.isIdentifier(current)) {
			return false;
		}
		const source = this._arrays.get(current.text);
		return source !== undefined && this.append_array_binding(binding, source);
	}

	/** Responsibilities: _array alias state_. **/
	public constructor(values: Map<string, string>, arrays: Map<string, StaticExpressionArrayContract>) {
		this._expression_aliases = new TypeScriptExpressionAliases("", new TypeScriptObjectAliasDeclarationIndex());
		this._expression_names = new TypeScriptExpressionNames();
		this._static_key_kinds = new Set([
			ts.SyntaxKind.StringLiteral,
			ts.SyntaxKind.NoSubstitutionTemplateLiteral,
			ts.SyntaxKind.NumericLiteral,
		]);
		this._values = values;
		this._arrays = arrays;
	}

	/** Responsibilities: _array source collection_. **/
	public append_source(node: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(node.name)) {
			return false;
		}
		if (node.initializer === undefined) {
			return false;
		}
		const current = this._expression_aliases.unwrapped(node.initializer);
		const name = node.name.text;
		if (this._arrays.has(name)) {
			return false;
		}
		if (ts.isArrayLiteralExpression(current)) {
			this._arrays.set(name, this.normalized_elements(current.elements));
			return true;
		}
		return this.append_named_source(name, current);
	}

	/** Responsibilities: _array declaration collection_. **/
	public append_declaration(node: ts.VariableDeclaration): boolean {
		if (!ts.isArrayBindingPattern(node.name) || node.initializer === undefined) {
			return false;
		}
		const initializer = this._expression_aliases.unwrapped(node.initializer);
		if (ts.isArrayLiteralExpression(initializer)) {
			return this.append_array_binding(node.name, this.normalized_elements(initializer.elements));
		}
		return this.append_binding_source(node.name, initializer);
	}
}
