import type { StaticExpressionArrayContract } from "src/analysis_protocols";
import type { StaticArraySourceAppenderContract } from "src/analysis_protocols";
import { StaticExpressionArray } from "src/parser/typescript-aliases/callables/static-array/static_expression_array";
import { TypeScriptStaticArrayIndexValues } from "src/parser/typescript-aliases/callables/static-array/type_script_static_array_index_values";
import { TypeScriptStaticArrayStructure } from "src/parser/typescript-aliases/callables/static-array/type_script_static_array_structure";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptMemberAliases } from "src/parser/typescript-aliases/type_script_member_aliases";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type {
	TypeScriptStaticArrayStructureContract,
	TypeScriptStaticArrayValuesContract,
} from "src/typescript_analysis_protocols";
import type { TypeScriptStaticArrayExpressionTarget } from "src/typescript_analysis_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import type { TypeScriptMemberAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _array values_, _spread values_. **/
export class TypeScriptStaticArrayValues
	implements TypeScriptStaticArrayValuesContract, StaticArraySourceAppenderContract
{
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _array_aliases: TypeScriptExpressionAliasesContract;
	private readonly _array_member_aliases: TypeScriptMemberAliasesContract;
	private readonly _array_sources: Map<string, StaticExpressionArrayContract>;
	private readonly _structural_values: TypeScriptStaticArrayStructureContract;

	/** Responsibilities: _array source part resolution_. **/
	private array_part(element: ts.Expression): StaticExpressionArrayContract {
		if (!ts.isSpreadElement(element)) {
			return new StaticExpressionArray([element], []);
		}
		const spread = this._expression_names.unwrap_transparent_expression(element.expression);
		if (ts.isArrayLiteralExpression(spread)) {
			return this.sequence(spread);
		}
		if (ts.isIdentifier(spread)) {
			const array = this._array_sources.get(spread.text);
			if (array !== undefined) {
				return array;
			}
		}
		return new StaticExpressionArray([], []);
	}

	/** Responsibilities: _static array argument expansion_. **/
	private append_argument(target: ts.Expression[], argument: ts.Expression): boolean {
		if (!ts.isSpreadElement(argument)) {
			target.push(argument);
			return true;
		}
		return this.append(target, argument.expression);
	}

	/** Responsibilities: _argument sequence expansion_. **/
	private append_expanded_arguments(target: ts.Expression[], call_arguments: readonly ts.Expression[]): boolean {
		if (call_arguments.length === 0) {
			return false;
		}
		const values: ts.Expression[] = [];
		for (const argument of call_arguments) {
			if (!this.append_argument(values, argument)) {
				return false;
			}
		}
		target.push(...values);
		return true;
	}

	/** Responsibilities: _array method source values_. **/
	private append_call_values(destination: ts.Expression[], expression: ts.CallExpression): boolean {
		if (this._array_aliases.receiver({ expression: expression.expression, node: expression })) {
			return this.append_expanded_arguments(destination, expression.arguments);
		}
		if (this.matches_array_method(expression, "of")) {
			return this.append_expanded_arguments(destination, expression.arguments);
		}
		if (!this.matches_array_method(expression, "from")) {
			return false;
		}
		return this.append_from_sources({ values: destination }, expression.arguments);
	}

	/** Responsibilities: _Array.from source collection_. **/
	private append_from_sources(
		context: TypeScriptStaticArrayExpressionTarget,
		array_from_arguments: readonly ts.Expression[],
	): boolean {
		const { values: target } = context;
		const sources: ts.Expression[] = [];
		if (!this.append_expanded_arguments(sources, array_from_arguments)) {
			return false;
		}
		for (const source of sources) {
			const resolved: ts.Expression[] = [];
			if (!this.append(resolved, source)) {
				return false;
			}
			target.push(...resolved);
		}
		return true;
	}

	/** Responsibilities: _new Array argument expansion_. **/
	private append_new_values(context: TypeScriptStaticArrayExpressionTarget, expression: ts.NewExpression): boolean {
		const { values: target } = context;
		if (!this._array_aliases.receiver({ expression: expression.expression, node: expression })) {
			return false;
		}
		if (expression.arguments === undefined) {
			return false;
		}
		return this.append_expanded_arguments(target, expression.arguments);
	}

	/** Responsibilities: _Array method invocation classification_. **/
	private matches_array_method(expression: ts.CallExpression, name: string): boolean {
		if (ts.isIdentifier(expression.expression)) {
			return this._array_member_aliases.property({ expression: expression.expression, node: expression, name });
		}
		const member = expression.expression;
		if (!ts.isPropertyAccessExpression(member) && !ts.isElementAccessExpression(member)) {
			return false;
		}
		if (this._array_aliases.member_name({ expression: member }) !== name) {
			return false;
		}
		return this._array_aliases.receiver({ expression: member.expression, node: expression });
	}

	/** Responsibilities: _dynamic array source resolution_. **/
	private append_dynamic_source(destination: ts.Expression[], current: ts.Expression): boolean {
		if (ts.isCallExpression(current)) {
			return this.append_call_values(destination, current);
		}
		if (ts.isNewExpression(current)) {
			return this.append_new_values({ values: destination }, current);
		}
		if (!ts.isIdentifier(current)) {
			return false;
		}
		const source = this._array_sources.get(current.text);
		if (source === undefined) {
			return false;
		}
		source.append_to(destination);
		return true;
	}

	/** Responsibilities: _static array source dependencies_. **/
	public constructor(
		array_sources: Map<string, StaticExpressionArrayContract>,
		numeric_sources: Map<string, number>,
		expression_names: ExpressionNamesContract,
		declaration_index: TypeScriptObjectAliasDeclarationIndexContract,
	) {
		this._array_sources = array_sources;
		const index_values = new TypeScriptStaticArrayIndexValues(numeric_sources, declaration_index);
		this._structural_values = new TypeScriptStaticArrayStructure(array_sources, index_values, this);
		this._array_aliases = new TypeScriptExpressionAliases("Array", declaration_index);
		this._array_member_aliases = new TypeScriptMemberAliases("Array", () => "", declaration_index);
		this._expression_names = expression_names;
	}

	/** Responsibilities: _array source values collection_. **/
	public append(expressions: ts.Expression[], source_expression: ts.Expression): boolean {
		const current = this._expression_names.unwrap_transparent_expression(source_expression);
		if (this._structural_values.append(expressions, current)) {
			return true;
		}
		return this.append_dynamic_source(expressions, current);
	}

	/** Responsibilities: _array value sequence_. **/
	public values(expression: ts.Expression): readonly ts.Expression[] {
		const values: ts.Expression[] = [];
		this.append(values, expression);
		return values;
	}

	/** Responsibilities: _array source sequence_. **/
	public sequence(expression: ts.Expression): StaticExpressionArrayContract {
		const current = this._expression_names.unwrap_transparent_expression(expression);
		if (ts.isArrayLiteralExpression(current)) {
			if (!current.elements.some(ts.isSpreadElement)) {
				return new StaticExpressionArray(current.elements, []);
			}
			const parts = current.elements.map((element) => this.array_part(element));
			return new StaticExpressionArray([], parts);
		}
		if (ts.isIdentifier(current)) {
			const source = this._array_sources.get(current.text);
			if (source === undefined) {
				return new StaticExpressionArray([], []);
			}
			return source;
		}
		return this._structural_values.sequence(current);
	}
}
