import ts from 'typescript';
import { TypeScriptStaticArraySources } from 'src/typescript-callable-aliases/static-array/typescript-static-array-sources';
import { TypeScriptStaticArrayValues } from 'src/typescript-callable-aliases/static-array/typescript-static-array-value-resolver';

/** Responsibilities: _destructured static array aliases_. **/
export class TypeScriptStaticArrayExpressionBindings {
	private readonly array_sources = new Map<string, readonly ts.Expression[]>();
	private readonly numeric_sources = new Map<string, number>();
	private readonly sources: TypeScriptStaticArraySources;
	private readonly array_values: TypeScriptStaticArrayValues;
	private readonly append_value: (
		values: Map<string, string>,
		name: string,
		initializer: ts.Expression
	) => boolean;

	/** Responsibilities: _static array binding element_. **/
	private append_array_element(
		values: Map<string, string>,
		element: ts.ArrayBindingElement,
		value: ts.Expression
	): boolean {
		if (!ts.isBindingElement(element) || element.dotDotDotToken) {
			return false;
		}
		if (ts.isArrayBindingPattern(element.name)) {
			return this.append_nested(values, element.name, value);
		}
		if (!ts.isIdentifier(element.name)) {
			return false;
		}
		return this.append_value(values, element.name.text, value);
	}

	/** Responsibilities: _static array rest source_. **/
	private append_rest_source(
		element: ts.ArrayBindingElement,
		index: number,
		source: readonly ts.Expression[]
	): boolean {
		if (!ts.isBindingElement(element)) {
			return false;
		}
		if (!element.dotDotDotToken || !ts.isIdentifier(element.name)) {
			return false;
		}
		return this.sources.append_rest(element.name.text, source.slice(index));
	}

	/** Responsibilities: _static array rest sources_. **/
	private append_rest_sources(binding: ts.ArrayBindingPattern, source: readonly ts.Expression[]): boolean {
		let changed = false;
		for (let index = 0; index < binding.elements.length; index += 1) {
			if (this.append_rest_source(binding.elements[index], index, source)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _nested static array aliases_. **/
	private append_nested(
		values: Map<string, string>,
		binding: ts.ArrayBindingPattern,
		value: ts.Expression
	): boolean {
		const current = value;
		if (!ts.isArrayLiteralExpression(current)) {
			return false;
		}
		return this.append_values(values, binding, current.elements);
	}

	/** Responsibilities: _static array binding values_. **/
	private append_values(
		values: Map<string, string>,
		binding: ts.ArrayBindingPattern,
		source: readonly ts.Expression[]
	): boolean {
		let changed = this.append_rest_sources(binding, source);
		for (let index = 0; index < binding.elements.length; index += 1) {
			const value = source[index];
			if (value === undefined) {
				continue;
			}
			if (this.append_array_element(values, binding.elements[index], value)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _static array alias dependencies_. **/
	public constructor(
		append_value: (values: Map<string, string>, name: string, initializer: ts.Expression) => boolean
	) {
		this.sources = new TypeScriptStaticArraySources(this.array_sources, this.numeric_sources);
		this.array_values = new TypeScriptStaticArrayValues(this.array_sources, this.numeric_sources);
		this.append_value = append_value;
	}

	/** Responsibilities: _static array binding collection_. **/
	public append_binding(values: Map<string, string>, node: ts.VariableDeclaration): boolean {
		if (!ts.isArrayBindingPattern(node.name) || node.initializer === undefined) {
			return false;
		}
		const source = this.array_values.values(node.initializer);
		return this.append_values(values, node.name, source);
	}

	/** Responsibilities: _static array assignment aliases_. **/
	public append_assignment(node: ts.BinaryExpression): boolean {
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		if (!ts.isIdentifier(node.left)) {
			return false;
		}
		return this.sources.append_assignment(node.left.text, node.right);
	}

	/** Responsibilities: _static array alias collection_. **/
	public append(values: Map<string, string>, node: ts.VariableDeclaration): boolean {
		let changed = this.sources.append_source(node);
		if (this.append_binding(values, node)) {
			changed = true;
		}
		return changed;
	}
}
