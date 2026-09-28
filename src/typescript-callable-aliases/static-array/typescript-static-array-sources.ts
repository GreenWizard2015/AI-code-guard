import ts from 'typescript';
import { TypeScriptExpressionAliases } from 'src/typescript-aliases/typescript-expression-aliases';
import { TypeScriptStaticArrayIndexValues } from 'src/typescript-callable-aliases/static-array/typescript-static-array-index-values';
import { TypeScriptStaticArrayValues } from 'src/typescript-callable-aliases/static-array/typescript-static-array-value-resolver';

/** Responsibilities: _static array source resolution_. **/
export class TypeScriptStaticArraySources {
	private readonly expression_aliases = new TypeScriptExpressionAliases('');
	private readonly array_sources: Map<string, readonly ts.Expression[]>;
	private readonly numeric_sources: Map<string, number>;
	private readonly index_values: TypeScriptStaticArrayIndexValues;
	private readonly array_values: TypeScriptStaticArrayValues;

	/** Responsibilities: _array literal source collection_. **/
	private append_literal_source(name: string, current: ts.Expression): boolean {
		if (!ts.isArrayLiteralExpression(current) || this.array_sources.has(name)) {
			return false;
		}
		this.array_sources.set(name, this.array_values.values(current));
		return true;
	}

	/** Responsibilities: _array source alias collection_. **/
	private append_alias_source(name: string, current: ts.Expression): boolean {
		if (!ts.isIdentifier(current) || this.array_sources.has(name)) {
			return false;
		}
		const source = this.array_sources.get(current.text);
		if (source === undefined) {
			return false;
		}
		this.array_sources.set(name, source);
		return true;
	}

	/** Responsibilities: _alternative array source collection_. **/
	private append_expression_source(name: string, current: ts.Expression): boolean {
		if (this.array_sources.has(name)) {
			return false;
		}
		const values = this.array_values.values(current);
		if (values.length === 0) {
			return false;
		}
		this.array_sources.set(name, values);
		return true;
	}

	/** Responsibilities: _numeric array alias collection_. **/
	private append_numeric_source(name: string, current: ts.Expression): boolean {
		const value = this.index_values.numeric_index(current);
		if (value < 0 || this.numeric_sources.has(name)) {
			return false;
		}
		this.numeric_sources.set(name, value);
		return true;
	}

	/** Responsibilities: _array source equality_. **/
	private same_values(left: readonly ts.Expression[], right: readonly ts.Expression[]): boolean {
		if (left.length !== right.length) {
			return false;
		}
		for (let index = 0; index < left.length; index += 1) {
			if (left[index].getText() !== right[index].getText()) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _static array source dependencies_. **/
	public constructor(
		array_sources: Map<string, readonly ts.Expression[]>,
		numeric_sources: Map<string, number>
	) {
		this.array_sources = array_sources;
		this.numeric_sources = numeric_sources;
		this.index_values = new TypeScriptStaticArrayIndexValues(this.numeric_sources);
		this.array_values = new TypeScriptStaticArrayValues(this.array_sources, this.numeric_sources);
	}

	/** Responsibilities: _array source declaration collection_. **/
	public append_source(node: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(node.name) || node.initializer === undefined) {
			return false;
		}
		const current = this.expression_aliases.unwrapped(node.initializer);
		if (this.append_numeric_source(node.name.text, current)) {
			return true;
		}
		if (this.append_literal_source(node.name.text, current)) {
			return true;
		}
		if (this.append_alias_source(node.name.text, current)) {
			return true;
		}
		return this.append_expression_source(node.name.text, current);
	}

	/** Responsibilities: _array assignment source collection_. **/
	public append_assignment(name: string, expression: ts.Expression): boolean {
		const current = this.expression_aliases.unwrapped(expression);
		const value = this.index_values.numeric_index(current);
		if (value >= 0) {
			if (this.numeric_sources.get(name) === value) {
				return false;
			}
			this.numeric_sources.set(name, value);
			return true;
		}
		const values = this.array_values.values(current);
		const existing = this.array_sources.get(name);
		if (existing !== undefined && this.same_values(existing, values)) {
			return false;
		}
		this.array_sources.set(name, values);
		return true;
	}

	/** Responsibilities: _array rest source collection_. **/
	public append_rest(name: string, values: readonly ts.Expression[]): boolean {
		if (this.array_sources.has(name)) {
			return false;
		}
		this.array_sources.set(name, values);
		return true;
	}

}
