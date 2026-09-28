import ts from 'typescript';
import { TypeScriptFactoryObjectBindingSources } from 'src/bridge/ts/runner/orchestration/runtime/typescript-singleton/factory-array-sources/factory-object-binding-sources';
import type { FactoryObjectSourcesContract } from 'src/bridge/ts/runner/orchestration/runtime/protocols';
import { TypeScriptExpressionNames } from 'src/typescript-aliases/typescript-expression-names';

/** Responsibilities: _array object binding sources_. **/
export class TypeScriptFactoryArrayObjectSources {
	private readonly expression_names = new TypeScriptExpressionNames();
	private readonly object_sources: FactoryObjectSourcesContract;
	private readonly object_bindings: TypeScriptFactoryObjectBindingSources;
	private readonly elements: (initializer: ts.ArrayLiteralExpression) => readonly ts.Expression[];

	/** Responsibilities: _binding element source_. **/
	private binding_element_source(element: ts.BindingElement, value: ts.Expression, name: string): string {
		if (ts.isArrayBindingPattern(element.name)) {
			return this.nested_source(element.name, value, name);
		}
		if (ts.isObjectBindingPattern(element.name)) {
			const binding = element.name;
			let result = '';
			this.object_sources.append(value, (initializer) => {
				result = this.object_bindings.source(
					initializer,
					binding,
					name,
					(nested_binding, nested_value, nested_name) => this.nested_source(nested_binding, nested_value, nested_name),
				);
			});
			return result;
		}
		return this.direct_source(element, value, name);
	}

	/** Responsibilities: _array element source_. **/
	private element_source(element: ts.Node, value: ts.Expression, name: string): string {
		if (ts.isArrayBindingPattern(element)) {
			return this.nested_source(element, value, name);
		}
		if (!ts.isBindingElement(element)) {
			return '';
		}
		return this.binding_element_source(element, value, name);
	}

	/** Responsibilities: _direct array source_. **/
	private direct_source(element: ts.BindingElement, value: ts.Expression, name: string): string {
		if (!ts.isIdentifier(element.name) || element.name.text !== name) {
			return '';
		}
		const source = this.expression_names.unwrap_transparent_expression(value);
		if (ts.isIdentifier(source)) {
			return source.text;
		}
		return '';
	}

	/** Responsibilities: _nested array source_. **/
	private nested_source(binding: ts.ArrayBindingPattern, value: ts.Expression, name: string): string {
		const source = this.expression_names.unwrap_transparent_expression(value);
		if (!ts.isArrayLiteralExpression(source)) {
			return '';
		}
		return this.binding_source(binding, this.elements(source), name);
	}

	/** Responsibilities: _resolver state_. **/
	public constructor(
		object_sources: FactoryObjectSourcesContract,
		elements: (initializer: ts.ArrayLiteralExpression) => readonly ts.Expression[],
	) {
		this.object_sources = object_sources;
		this.object_bindings = new TypeScriptFactoryObjectBindingSources(object_sources);
		this.elements = elements;
	}

	/** Responsibilities: _array object source_. **/
	public source(
		binding: ts.ObjectBindingPattern,
		expression: ts.Expression,
		name: string,
	): string {
		let result = '';
		this.object_sources.append(expression, (initializer) => {
			result = this.object_bindings.source(
				initializer,
				binding,
				name,
				(nested_binding, nested_value, nested_name) => this.nested_source(nested_binding, nested_value, nested_name),
			);
		});
		return result;
	}

	/** Responsibilities: _array binding source_. **/
	public binding_source(
		binding: ts.ArrayBindingPattern,
		values: readonly ts.Expression[],
		name: string,
	): string {
		for (let index = 0; index < binding.elements.length; index += 1) {
			const value = values[index];
			if (value === undefined) {
				continue;
			}
			const source = this.element_source(binding.elements[index], value, name);
			if (source !== '') {
				return source;
			}
		}
		return '';
	}
}
