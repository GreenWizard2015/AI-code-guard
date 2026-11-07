import type { StaticExpressionArrayContract } from "src/analysis_protocols";
import type { StaticExpressionArray } from "src/parser/typescript-aliases/callables/static-array/static_expression_array";
import { TypeScriptStaticArraySources } from "src/parser/typescript-aliases/callables/static-array/type_script_static_array_sources";
import { TypeScriptStaticArrayValues } from "src/parser/typescript-aliases/callables/static-array/type_script_static_array_values";
import { TypeScriptStaticObjectProperties } from "src/parser/typescript-aliases/callables/static-key/type_script_static_object_properties";
import { TypeScriptStaticObjectSources } from "src/parser/typescript-aliases/callables/type_script_static_object_sources";
import type {
	StaticObjectBindingContext,
	StaticObjectBindingQuery,
	StaticObjectDeclarationQuery,
} from "src/parser/typescript-aliases/protocols";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { CallableSpreadValueAppender } from "src/runtime_types";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type {
	TypeScriptStaticObjectArgumentsContract,
	TypeScriptStaticObjectBindingsContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _object alias state_, _array alias state_. **/
export class TypeScriptStaticObjectBindings
	implements TypeScriptStaticObjectBindingsContract, TypeScriptStaticObjectArgumentsContract
{
	private readonly _declaration_index: TypeScriptObjectAliasDeclarationIndex;
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly _array_sources: Map<string, StaticExpressionArrayContract>;
	private readonly _numeric_sources: Map<string, number>;
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _array_collector: TypeScriptStaticArraySources;
	private readonly _array_values: TypeScriptStaticArrayValues;
	private readonly _source_collector: TypeScriptStaticObjectSources;

	/** Responsibilities: _named declarations_. **/
	private append_named_declaration(query: StaticObjectDeclarationQuery): boolean {
		const { context, node } = query;
		if (node.initializer === undefined) {
			return false;
		}
		const changed = this._array_collector.append_source(node);
		this.append_object_alias(context, node.name.getText(), node.initializer);
		return changed;
	}

	/** Responsibilities: _destructured declarations_. **/
	private append_destructured_declaration(query: StaticObjectDeclarationQuery): boolean {
		const { context, node } = query;
		if (node.initializer === undefined) {
			return false;
		}
		const properties = new TypeScriptStaticObjectProperties(context);
		const binding: StaticObjectBindingQuery = { binding: node.name, initializer: node.initializer };
		return properties.append_binding(binding);
	}

	/** Responsibilities: _register object initializers_, _reuse object aliases_. **/
	private append_object_alias(context: StaticObjectBindingContext, name: string, initializer: ts.Expression): void {
		if (this._source_collector.append_source(context.objects, name, initializer)) {
			return;
		}
		const current = this._expression_aliases.unwrapped(initializer);
		if (!ts.isIdentifier(current)) {
			return;
		}
		const object = context.objects.get(current.text);
		if (object !== undefined) {
			context.objects.set(name, object);
		}
	}

	/** Responsibilities: _alias collector dependencies_. **/
	public constructor() {
		const declaration_index = new TypeScriptObjectAliasDeclarationIndex();
		this._declaration_index = declaration_index;
		this._expression_aliases = new TypeScriptExpressionAliases("", declaration_index);
		this._array_sources = new Map<string, StaticExpressionArray>();
		this._numeric_sources = new Map<string, number>();
		this._expression_names = new TypeScriptExpressionNames();
		this._array_collector = new TypeScriptStaticArraySources(
			this._array_sources,
			this._numeric_sources,
			this._expression_names,
			declaration_index,
		);
		this._array_values = new TypeScriptStaticArrayValues(
			this._array_sources,
			this._numeric_sources,
			this._expression_names,
			declaration_index,
		);
		this._source_collector = new TypeScriptStaticObjectSources(this, declaration_index);
	}

	/** Responsibilities: _array source assignments_. **/
	public append_assignment(node: ts.BinaryExpression): boolean {
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken || !ts.isIdentifier(node.left)) {
			return false;
		}
		return this._array_collector.append_assignment(node.left.text, node.right);
	}

	/** Responsibilities: _static spread expansion_. **/
	public append_spread(element: ts.SpreadElement, append_value: CallableSpreadValueAppender): boolean {
		const values: ts.Expression[] = [];
		this._array_values.sequence(element.expression).append_to(values);
		let found = false;
		for (const value of values) {
			if (append_value(value)) {
				found = true;
			}
		}
		return found;
	}

	/** Responsibilities: _declaration alias collection_. **/
	public append(
		values: Map<string, string>,
		objects: Map<string, ts.ObjectLiteralExpression>,
		node: ts.VariableDeclaration,
	): boolean {
		const context: StaticObjectBindingContext = {
			values,
			objects,
			arguments_source: this,
			declaration_index: this._declaration_index,
		};
		const query: StaticObjectDeclarationQuery = { context, node };
		if (ts.isIdentifier(node.name)) {
			return this.append_named_declaration(query);
		}
		return this.append_destructured_declaration(query);
	}
}
