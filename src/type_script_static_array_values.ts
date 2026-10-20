import ts from "typescript";
import { TypeScriptStaticArrayIndexValues } from "src/typescript-aliases/callables/static-array/type_script_static_array_index_values";
import { TypeScriptStaticArrayStructure } from "src/typescript-aliases/callables/static-array/type_script_static_array_structure";
import { StaticExpressionArray } from "src/static_expression_array";
import type { StaticExpressionArrayContract } from "src/analysis_protocols";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { StaticArraySourceAppenderContract } from "src/analysis_protocols";
import type { StaticArrayMethodsContract } from "src/shared_services_protocols";
import type { TypeScriptStaticArrayValuesContract, TypeScriptStaticArrayStructureContract } from "src/typescript_analysis_protocols";

/** Responsibilities: _array values_, _spread values_. **/
export class TypeScriptStaticArrayValues
	implements TypeScriptStaticArrayValuesContract, StaticArraySourceAppenderContract
{
	private readonly expression_names: ExpressionNamesContract;
	private readonly array_methods: StaticArrayMethodsContract;
	private readonly array_sources: Map<string, StaticExpressionArrayContract>;
	private readonly structural_values: TypeScriptStaticArrayStructureContract;

	/** Responsibilities: _array spread resolution_. **/
	private spread_values(expression: ts.Expression): StaticExpressionArrayContract {
		const current = this.expression_names.unwrap_transparent_expression(expression);
		if (ts.isArrayLiteralExpression(current)) {
			return this.array_values(current);
		}
		if (!ts.isIdentifier(current)) {
			return new StaticExpressionArray([], [], 0n);
		}
		const source = this.array_sources.get(current.text);
		if (source === undefined) {
			return new StaticExpressionArray([], [], 0n);
		}
		return source;
	}

	/** Responsibilities: _array literal flattening_. **/
	private array_values(source: ts.ArrayLiteralExpression): StaticExpressionArrayContract {
		const parts: StaticExpressionArrayContract[] = [];
		for (const element of source.elements) {
			if (ts.isSpreadElement(element)) {
				parts.push(this.spread_values(element.expression));
				continue;
			}
			parts.push(new StaticExpressionArray([element], [], 1n));
		}
		return new StaticExpressionArray(
			[],
			parts,
			parts.reduce((size, part) => size + part.size, 0n),
		);
	}

	/** Responsibilities: _named array source resolution_. **/
	private append_named_source(values: ts.Expression[], current: ts.Identifier): boolean {
		const source = this.array_sources.get(current.text);
		if (source === undefined) {
			return false;
		}
		source.append_to(values);
		return true;
	}

	/** Responsibilities: _first static Array.from source_. **/
	private append_from_source(values: ts.Expression[], arguments_list: readonly ts.Expression[]): boolean {
		for (const source of arguments_list) {
			const resolved: ts.Expression[] = [];
			if (!this.append(resolved, source)) {
				return false;
			}
			for (const value of resolved) {
				values.push(value);
			}
			return true;
		}
		return false;
	}

	/** Responsibilities: _Array.from source collection_. **/
	private append_array_from(values: ts.Expression[], expression: ts.CallExpression): boolean {
		if (!this.array_methods.matches_array_from(expression)) {
			return false;
		}
		const arguments_list: ts.Expression[] = [];
		if (!this.append_arguments(arguments_list, expression.arguments)) {
			return false;
		}
		return this.append_from_source(values, arguments_list);
	}

	/** Responsibilities: _invocation argument values_. **/
	private append_arguments(values: ts.Expression[], arguments_list: readonly ts.Expression[]): boolean {
		let found = false;
		for (const argument of arguments_list) {
			if (ts.isSpreadElement(argument)) {
				if (!this.append(values, argument.expression)) {
					return false;
				}
				found = true;
				continue;
			}
			values.push(argument);
			found = true;
		}
		return found;
	}

	/** Responsibilities: _array method source values_. **/
	private append_call_values(values: ts.Expression[], expression: ts.CallExpression): boolean {
		const arguments_list: ts.Expression[] = [];
		if (this.array_methods.append(arguments_list, expression)) {
			return this.append_arguments(values, arguments_list);
		}
		return this.append_array_from(values, expression);
	}

	/** Responsibilities: _new Array source values_. **/
	private append_new_values(values: ts.Expression[], expression: ts.NewExpression): boolean {
		const arguments_list: ts.Expression[] = [];
		if (!this.array_methods.append(arguments_list, expression)) {
			return false;
		}
		return this.append_arguments(values, arguments_list);
	}

	/** Responsibilities: _static array source dependencies_. **/
	public constructor(
		array_sources: Map<string, StaticExpressionArrayContract>,
		numeric_sources: Map<string, number>,
		array_methods: StaticArrayMethodsContract,
		expression_names: ExpressionNamesContract,
	) {
		this.array_sources = array_sources;
		const index_values = new TypeScriptStaticArrayIndexValues(numeric_sources);
		this.structural_values = new TypeScriptStaticArrayStructure(array_sources, index_values);
		this.array_methods = array_methods;
		this.expression_names = expression_names;
	}

	/** Responsibilities: _array source values collection_. **/
	public append(values: ts.Expression[], expression: ts.Expression): boolean {
		const current = this.expression_names.unwrap_transparent_expression(expression);
		if (this.structural_values.append(values, current, this)) {
			return true;
		}
		if (ts.isCallExpression(current)) {
			return this.append_call_values(values, current);
		}
		if (ts.isNewExpression(current)) {
			return this.append_new_values(values, current);
		}
		if (!ts.isIdentifier(current)) {
			return false;
		}
		return this.append_named_source(values, current);
	}

	/** Responsibilities: _array value sequence_. **/
	public values(expression: ts.Expression): readonly ts.Expression[] {
		const values: ts.Expression[] = [];
		this.append(values, expression);
		return values;
	}

	/** Responsibilities: _array source sequence_. **/
	public sequence(expression: ts.Expression): StaticExpressionArrayContract {
		const current = this.expression_names.unwrap_transparent_expression(expression);
		if (ts.isArrayLiteralExpression(current)) {
			return this.array_values(current);
		}
		if (ts.isIdentifier(current)) {
			const source = this.array_sources.get(current.text);
			if (source === undefined) {
				return new StaticExpressionArray([], [], 0n);
			}
			return source;
		}
		return this.structural_values.sequence(current, this);
	}
}
