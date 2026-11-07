import type { StaticExpressionArrayContract } from "src/analysis_protocols";
import type { TypeScriptStaticArraySourcesContract } from "src/parser/typescript-aliases/protocols";
import type { CallableMapValueAppender } from "src/runtime_types";
import type { TypeScriptStaticArrayValuesContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _array destructuring values_, _rest source registration_. **/
export class TypeScriptStaticArrayBindingValues {
	private readonly _values: Map<string, string>;
	private readonly _sources: TypeScriptStaticArraySourcesContract;
	private readonly _array_values: TypeScriptStaticArrayValuesContract;
	private readonly _append_value: CallableMapValueAppender;

	/** Responsibilities: _array binding element value_. **/
	private append_element(element: ts.ArrayBindingElement, value: ts.Expression): boolean {
		if (!ts.isBindingElement(element) || element.dotDotDotToken) {
			return false;
		}
		if (ts.isArrayBindingPattern(element.name)) {
			if (!ts.isArrayLiteralExpression(value)) {
				return false;
			}
			return this.append_values(element.name, this._array_values.sequence(value));
		}
		if (!ts.isIdentifier(element.name)) {
			return false;
		}
		return this._append_value(this._values, element.name.text, value);
	}

	/** Responsibilities: _array rest source registration_. **/
	private append_rest_sources(binding: ts.ArrayBindingPattern, source: StaticExpressionArrayContract): boolean {
		let changed = false;
		for (let index = 0; index < binding.elements.length; index += 1) {
			const element = binding.elements[index];
			if (element === undefined || !ts.isBindingElement(element)) {
				continue;
			}
			if (!element.dotDotDotToken || !ts.isIdentifier(element.name)) {
				continue;
			}
			if (this._sources.append_rest({ name: element.name.text, values: source.slice(index) })) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _array binding value ownership_. **/
	public constructor(
		values: Map<string, string>,
		sources: TypeScriptStaticArraySourcesContract,
		array_values: TypeScriptStaticArrayValuesContract,
		append_value: CallableMapValueAppender,
	) {
		this._values = values;
		this._sources = sources;
		this._array_values = array_values;
		this._append_value = append_value;
	}

	/** Responsibilities: _array binding value expansion_. **/
	public append_values(binding: ts.ArrayBindingPattern, source: StaticExpressionArrayContract): boolean {
		let changed = this.append_rest_sources(binding, source);
		for (let index = 0; index < binding.elements.length; index += 1) {
			if (!source.contains(BigInt(index))) {
				continue;
			}
			const element = binding.elements[index];
			if (element !== undefined && this.append_element(element, source.at(BigInt(index)))) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _array destructuring collection_. **/
	public append_binding(node: ts.VariableDeclaration): boolean {
		if (!ts.isArrayBindingPattern(node.name)) {
			return false;
		}
		if (node.initializer === undefined) {
			return false;
		}
		const source = this._array_values.sequence(node.initializer);
		return this.append_values(node.name, source);
	}
}
