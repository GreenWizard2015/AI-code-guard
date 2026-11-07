import type { StaticExpressionArrayContract } from "src/analysis_protocols";
import type { StaticExpressionArray } from "src/parser/typescript-aliases/callables/static-array/static_expression_array";
import { TypeScriptStaticArraySources } from "src/parser/typescript-aliases/callables/static-array/type_script_static_array_sources";
import { TypeScriptStaticArrayValues } from "src/parser/typescript-aliases/callables/static-array/type_script_static_array_values";
import type { StaticArraySourceCollectionQuery } from "src/parser/typescript-aliases/protocols";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptStaticArrayKeysContract } from "src/typescript_runtime_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _static key expression resolution_, _array key source collection_. **/
export class TypeScriptStaticArrayKeys implements TypeScriptStaticArrayKeysContract {
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly _array_sources: Map<string, StaticExpressionArrayContract>;
	private readonly _numeric_sources: Map<string, number>;
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _declaration_index: TypeScriptObjectAliasDeclarationIndexContract;
	private readonly _sources: TypeScriptStaticArraySources;
	private readonly _values: TypeScriptStaticArrayValues;
	private readonly _collected_sources: WeakSet<ts.SourceFile>;
	private readonly _expressions_by_node: WeakMap<ts.Expression, readonly ts.Expression[]>;

	/** Responsibilities: _array declaration discovery_. **/
	private collect_sources(query: StaticArraySourceCollectionQuery): void {
		const { source_file } = query;
		if (this._collected_sources.has(source_file)) {
			return;
		}
		const declarations = this._declaration_index.variable_scope(source_file).all_variable_declarations();
		let changed = true;
		while (changed) {
			changed = false;
			for (const declaration of declarations) {
				if (this._sources.append_source(declaration)) {
					changed = true;
				}
			}
		}
		this._collected_sources.add(source_file);
	}

	/** Responsibilities: _resolution static array key_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor(declaration_index: TypeScriptObjectAliasDeclarationIndexContract) {
		this._collected_sources = new WeakSet<ts.SourceFile>();
		this._expressions_by_node = new WeakMap<ts.Expression, readonly ts.Expression[]>();
		this._declaration_index = declaration_index;
		this._expression_aliases = new TypeScriptExpressionAliases("", this._declaration_index);
		this._array_sources = new Map<string, StaticExpressionArray>();
		this._numeric_sources = new Map<string, number>();
		this._expression_names = new TypeScriptExpressionNames();
		this._sources = new TypeScriptStaticArraySources(
			this._array_sources,
			this._numeric_sources,
			this._expression_names,
			this._declaration_index,
		);
		this._values = new TypeScriptStaticArrayValues(
			this._array_sources,
			this._numeric_sources,
			this._expression_names,
			this._declaration_index,
		);
	}
	/** Responsibilities: _public operation_. **/
	public value(expression: ts.Expression, source_file: ts.SourceFile): string {
		this.collect_sources({ source_file });
		const candidates = this._values.sequence(expression);
		if (candidates.size() !== 1n) {
			return "";
		}
		const candidate = this._expression_aliases.unwrapped(candidates.at(0n));
		if (ts.isStringLiteral(candidate) || ts.isNoSubstitutionTemplateLiteral(candidate)) {
			return candidate.text;
		}
		return "";
	}

	/** Responsibilities: _resolution static array expressions_. **/
	public expressions(expression: ts.Expression, source_file: ts.SourceFile): readonly ts.Expression[] {
		this.collect_sources({ source_file });
		const cached = this._expressions_by_node.get(expression);
		if (cached !== undefined) {
			return cached;
		}
		const expressions: ts.Expression[] = [];
		this._values.sequence(expression).append_to(expressions);
		const resolved = Object.freeze(expressions);
		this._expressions_by_node.set(expression, resolved);
		return resolved;
	}
}
