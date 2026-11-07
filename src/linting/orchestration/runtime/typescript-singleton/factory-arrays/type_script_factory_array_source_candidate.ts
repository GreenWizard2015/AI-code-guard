import type {
	FactoryObjectSourcesContract,
	TypeScriptFactoryObjectBindingSourcesContract,
} from "src/contracts/protocols/lint_runtime_protocols";
import type { TypeScriptFactoryArraySourcesContract } from "src/contracts/protocols/lint_runtime_protocols";
import type { TypeScriptFactoryArraySourceCandidateOptions } from "src/linting/orchestration/runtime/typescript-singleton/factory-arrays/protocols";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import ts from "typescript";

/** Responsibilities: _array source candidate identity_, _candidate source resolution_. **/
export class TypeScriptFactoryArraySourceCandidate {
	private readonly _element: ts.Node;
	private readonly _value: ts.Expression;
	private readonly _name: string;
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _object_sources: FactoryObjectSourcesContract;
	private readonly _object_bindings: TypeScriptFactoryObjectBindingSourcesContract;
	private readonly _array_sources: TypeScriptFactoryArraySourcesContract;

	/** Responsibilities: _nested array source lookup_. **/
	private nested_source(binding: ts.ArrayBindingPattern): string {
		const source = this._expression_names.unwrap_transparent_expression(this._value);
		if (!ts.isArrayLiteralExpression(source)) {
			return "";
		}
		return this.binding_source(binding, this._array_sources.elements(source));
	}

	/** Responsibilities: _object binding source lookup_. **/
	private object_binding_source(binding: ts.ObjectBindingPattern): string {
		let result = "";
		this._object_sources.append(this._value, (initializer) => {
			result = this._object_bindings.source(
				initializer,
				binding,
				this._name,
				(nested_binding, nested_value, nested_name) => {
					const candidate = new TypeScriptFactoryArraySourceCandidate({
						element: nested_binding,
						value: nested_value,
						name: nested_name,
						expression_names: this._expression_names,
						object_sources: this._object_sources,
						object_bindings: this._object_bindings,
						array_sources: this._array_sources,
					});
					return candidate.source();
				},
			);
		});
		return result;
	}

	/** Responsibilities: _binding element source lookup_. **/
	private binding_element_source(): string {
		if (!ts.isBindingElement(this._element)) {
			return "";
		}
		if (ts.isArrayBindingPattern(this._element.name)) {
			return this.nested_source(this._element.name);
		}
		if (ts.isObjectBindingPattern(this._element.name)) {
			return this.object_binding_source(this._element.name);
		}
		return this.direct_source();
	}

	/** Responsibilities: _direct identifier source lookup_. **/
	private direct_source(): string {
		if (!this.matches_target()) {
			return "";
		}
		if (!ts.isBindingElement(this._element) || !ts.isIdentifier(this._element.name)) {
			return "";
		}
		const source = this._expression_names.unwrap_transparent_expression(this._value);
		if (ts.isIdentifier(source)) {
			return source.text;
		}
		return "";
	}

	/** Responsibilities: _nested array source search_. **/
	private binding_source(binding: ts.ArrayBindingPattern, values: readonly ts.Expression[]): string {
		for (const [index, element] of binding.elements.entries()) {
			const value = values.at(index);
			if (element === undefined || value === undefined) {
				continue;
			}
			const candidate = new TypeScriptFactoryArraySourceCandidate({
				element,
				value,
				name: this._name,
				expression_names: this._expression_names,
				object_sources: this._object_sources,
				object_bindings: this._object_bindings,
				array_sources: this._array_sources,
			});
			const source = candidate.source();
			if (source !== "") {
				return source;
			}
		}
		return "";
	}

	/** Responsibilities: _array candidate context setup_. **/
	public constructor(options: TypeScriptFactoryArraySourceCandidateOptions) {
		this._element = options.element;
		this._value = options.value;
		this._name = options.name;
		this._expression_names = options.expression_names;
		this._object_sources = options.object_sources;
		this._object_bindings = options.object_bindings;
		this._array_sources = options.array_sources;
	}

	/** Responsibilities: _candidate name matching_. **/
	public matches_target(): boolean {
		if (!ts.isBindingElement(this._element)) {
			return false;
		}
		if (!ts.isIdentifier(this._element.name)) {
			return false;
		}
		return this._element.name.text === this._name;
	}

	/** Responsibilities: _array source candidate resolution_. **/
	public source(): string {
		if (ts.isArrayBindingPattern(this._element)) {
			return this.nested_source(this._element);
		}
		if (!ts.isBindingElement(this._element)) {
			return "";
		}
		return this.binding_element_source();
	}
}
