import ts from "typescript";
import { TypeScriptStaticArrayIndexValues } from "src/typescript-aliases/callables/static-array/type_script_static_array_index_values";
import { TypeScriptStaticArrayValues } from "src/type_script_static_array_values";
import { TypeScriptStaticArrayMethods } from "src/type_script_static_array_methods";
import type { StaticExpressionArrayContract } from "src/analysis_protocols";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { TypeScriptStaticArrayIndexValuesContract, TypeScriptStaticArrayValuesContract, TypeScriptStaticArraySourcesContract } from "src/typescript_analysis_protocols";

/** Responsibilities: _array source alias tracking_, _numeric source tracking_. **/
export class TypeScriptStaticArraySources implements TypeScriptStaticArraySourcesContract {
	private readonly expression_names: ExpressionNamesContract;
	private readonly array_sources: Map<string, StaticExpressionArrayContract>;
	private readonly numeric_sources: Map<string, number>;
	private readonly uncertain_array_sources: Set<string>;
	private readonly assignment_names: Set<string>;
	private readonly index_values: TypeScriptStaticArrayIndexValuesContract;
	private readonly array_values: TypeScriptStaticArrayValuesContract;

	/** Responsibilities: _array literal source collection_. **/
	private append_literal_source(name: string, current: ts.Expression): boolean {
		if (!ts.isArrayLiteralExpression(current)) {
			return false;
		}
		if (this.has_known_source(name)) {
			return false;
		}
		this.array_sources.set(name, this.array_values.sequence(current));
		return true;
	}

	/** Responsibilities: _array source alias collection_. **/
	private append_alias_source(name: string, current: ts.Expression): boolean {
		if (!ts.isIdentifier(current)) {
			return false;
		}
		if (this.has_known_source(name)) {
			return false;
		}
		const source = this.array_sources.get(current.text);
		if (source === undefined) {
			return false;
		}
		this.array_sources.set(name, source);
		return true;
	}

	/** Responsibilities: _known array source classification_. **/
	private has_known_source(name: string): boolean {
		if (this.array_sources.has(name)) {
			return true;
		}
		return this.uncertain_array_sources.has(name);
	}

	/** Responsibilities: _alternative array source collection_. **/
	private append_expression_source(name: string, current: ts.Expression): boolean {
		if (this.array_sources.has(name) || this.uncertain_array_sources.has(name)) {
			return false;
		}
		const values = this.array_values.sequence(current);
		if (values.size === 0n) {
			return false;
		}
		this.array_sources.set(name, values);
		return true;
	}

	/** Responsibilities: _numeric array alias collection_. **/
	private append_numeric_source(name: string, current: ts.Expression): boolean {
		const value = this.index_values.numeric_index(current);
		if (value < 0) {
			return false;
		}
		if (this.numeric_sources.has(name)) {
			return false;
		}
		this.numeric_sources.set(name, value);
		return true;
	}

	/** Responsibilities: _array source equality_. **/
	private same_values(left: StaticExpressionArrayContract, right: StaticExpressionArrayContract): boolean {
		if (left === right) {
			return true;
		}
		if (left.size !== right.size) {
			return false;
		}
		for (let index = 0n; index < left.size; index += 1n) {
			if (left.at(index).getText() !== right.at(index).getText()) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _numeric array assignment_. **/
	private append_numeric_assignment(name: string, value: number): boolean {
		if (value < 0) {
			return false;
		}
		const existing = this.numeric_sources.get(name);
		if (existing === undefined) {
			this.numeric_sources.set(name, value);
			return true;
		}
		if (existing === value || existing < 0) {
			return false;
		}
		this.numeric_sources.set(name, -1);
		return true;
	}

	/** Responsibilities: _array value assignment_. **/
	private append_array_assignment(name: string, values: StaticExpressionArrayContract): boolean {
		if (this.uncertain_array_sources.has(name)) {
			return false;
		}
		if (!this.assignment_names.has(name)) {
			return this.first_assignment(name, values);
		}
		const existing = this.array_sources.get(name);
		if (existing === undefined) {
			this.array_sources.set(name, values);
			return true;
		}
		return this.repeat_assignment(name, values, existing);
	}

	/** Responsibilities: _first assignment_. **/
	private first_assignment(name: string, values: StaticExpressionArrayContract): boolean {
		const existing = this.array_sources.get(name);
		this.assignment_names.add(name);
		if (existing !== undefined) {
			if (this.same_values(existing, values)) {
				return false;
			}
		}
		this.array_sources.set(name, values);
		return true;
	}

	/** Responsibilities: _repeated assignment_. **/
	private repeat_assignment(
		name: string,
		values: StaticExpressionArrayContract,
		existing: StaticExpressionArrayContract,
	): boolean {
		if (this.same_values(existing, values)) {
			return false;
		}
		this.array_sources.delete(name);
		this.uncertain_array_sources.add(name);
		return true;
	}

	/** Responsibilities: _static array source dependencies_. **/
	public constructor(
		array_sources: Map<string, StaticExpressionArrayContract>,
		numeric_sources: Map<string, number>,
		expression_names: ExpressionNamesContract,
	) {
		this.array_sources = array_sources;
		this.numeric_sources = numeric_sources;
		this.uncertain_array_sources = new Set<string>();
		this.assignment_names = new Set<string>();
		this.expression_names = expression_names;
		this.index_values = new TypeScriptStaticArrayIndexValues(this.numeric_sources);
		this.array_values = new TypeScriptStaticArrayValues(
			this.array_sources,
			this.numeric_sources,
			new TypeScriptStaticArrayMethods(),
			expression_names,
		);
	}

	/** Responsibilities: _array source declaration collection_. **/
	public append_source(node: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(node.name)) {
			return false;
		}
		if (node.initializer === undefined) {
			return false;
		}
		const current = this.expression_names.unwrap_transparent_expression(node.initializer);
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
		const current = this.expression_names.unwrap_transparent_expression(expression);
		const value = this.index_values.numeric_index(current);
		if (this.append_numeric_assignment(name, value)) {
			return true;
		}
		const values = this.array_values.sequence(current);
		return this.append_array_assignment(name, values);
	}

	/** Responsibilities: _array rest source collection_. **/
	public append_rest(name: string, values: StaticExpressionArrayContract): boolean {
		if (this.array_sources.has(name)) {
			return false;
		}
		this.array_sources.set(name, values);
		return true;
	}
}
