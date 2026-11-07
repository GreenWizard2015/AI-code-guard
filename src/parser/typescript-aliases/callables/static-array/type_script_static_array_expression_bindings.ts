import type { StaticExpressionArrayContract } from "src/analysis_protocols";
import type { StaticExpressionArray } from "src/parser/typescript-aliases/callables/static-array/static_expression_array";
import { TypeScriptStaticArrayBindingValues } from "src/parser/typescript-aliases/callables/static-array/type_script_static_array_binding_values";
import { TypeScriptStaticArraySources } from "src/parser/typescript-aliases/callables/static-array/type_script_static_array_sources";
import { TypeScriptStaticArrayValues } from "src/parser/typescript-aliases/callables/static-array/type_script_static_array_values";
import type {
	TypeScriptStaticArrayExpressionBindingsContract,
	TypeScriptStaticArraySourcesContract,
} from "src/parser/typescript-aliases/protocols";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import type { CallableMapValueAppender } from "src/runtime_types";
import type { TypeScriptStaticArrayValuesContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _destructured array binding_, _array assignment alias collection_. **/
export class TypeScriptStaticArrayExpressionBindings implements TypeScriptStaticArrayExpressionBindingsContract {
	private readonly _array_sources: Map<string, StaticExpressionArrayContract>;
	private readonly _numeric_sources: Map<string, number>;
	private readonly _sources: TypeScriptStaticArraySourcesContract;
	private readonly _array_values: TypeScriptStaticArrayValuesContract;
	private readonly _append_value: CallableMapValueAppender;

	/** Responsibilities: _static array alias dependencies_. **/
	public constructor(append_value: CallableMapValueAppender) {
		this._array_sources = new Map<string, StaticExpressionArray>();
		this._numeric_sources = new Map<string, number>();
		const declaration_index = new TypeScriptObjectAliasDeclarationIndex();
		this._sources = new TypeScriptStaticArraySources(
			this._array_sources,
			this._numeric_sources,
			new TypeScriptExpressionNames(),
			declaration_index,
		);
		this._array_values = new TypeScriptStaticArrayValues(
			this._array_sources,
			this._numeric_sources,
			new TypeScriptExpressionNames(),
			declaration_index,
		);
		this._append_value = append_value;
	}

	/** Responsibilities: _static array binding collection_. **/
	public append_binding(values: Map<string, string>, node: ts.VariableDeclaration): boolean {
		const binding_values = new TypeScriptStaticArrayBindingValues(
			values,
			this._sources,
			this._array_values,
			this._append_value,
		);
		return binding_values.append_binding(node);
	}

	/** Responsibilities: _static array assignment aliases_. **/
	public append_assignment(node: ts.BinaryExpression): boolean {
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		if (!ts.isIdentifier(node.left)) {
			return false;
		}
		return this._sources.append_assignment(node.left.text, node.right);
	}

	/** Responsibilities: _static array alias collection_. **/
	public append(values: Map<string, string>, node: ts.VariableDeclaration): boolean {
		let changed = this._sources.append_source(node);
		const binding_values = new TypeScriptStaticArrayBindingValues(
			values,
			this._sources,
			this._array_values,
			this._append_value,
		);
		if (binding_values.append_binding(node)) {
			changed = true;
		}
		return changed;
	}
}
