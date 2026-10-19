import ts from "typescript";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";
import { TypeScriptStaticArraySources } from "src/type_script_static_array_sources";
import { TypeScriptStaticArrayValues } from "src/type_script_static_array_values";
import { TypeScriptStaticArrayMethods } from "src/type_script_static_array_methods";
import { TypeScriptExpressionNames } from "src/typescript-aliases/type_script_expression_names";
import { StaticExpressionArray } from "src/static_expression_array";
import type { StaticExpressionArrayContract } from "src/protocols";
import type { TypeScriptStaticArrayKeysContract } from "src/protocols";

/** Responsibilities: _static key expression resolution_, _array key source collection_. **/
export class TypeScriptStaticArrayKeys implements TypeScriptStaticArrayKeysContract {
	private readonly expression_aliases: TypeScriptExpressionAliases;
	private readonly array_sources: Map<string, StaticExpressionArrayContract>;
	private readonly numeric_sources: Map<string, number>;
	private readonly expression_names: TypeScriptExpressionNames;
	private readonly sources: TypeScriptStaticArraySources;
	private readonly values: TypeScriptStaticArrayValues;
	private readonly collected: WeakSet<ts.SourceFile>;

	/** Responsibilities: _collection static array declarations_. **/
	private collect(source_file: ts.SourceFile): void {
		if (this.collected.has(source_file)) {
			return;
		}
		let changed = true;
		while (changed) {
			changed = false;
			const visit = (node: ts.Node): void => {
				if (ts.isVariableDeclaration(node)) {
					if (this.sources.append_source(node)) {
						changed = true;
					}
				}
				ts.forEachChild(node, visit);
			};
			visit(source_file);
		}
		this.collected.add(source_file);
	}

	/** Responsibilities: _resolution static array key_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.expression_aliases = new TypeScriptExpressionAliases("");
		this.array_sources = new Map<string, StaticExpressionArray>();
		this.numeric_sources = new Map<string, number>();
		this.expression_names = new TypeScriptExpressionNames();
		this.sources = new TypeScriptStaticArraySources(this.array_sources, this.numeric_sources, this.expression_names);
		this.values = new TypeScriptStaticArrayValues(
			this.array_sources,
			this.numeric_sources,
			new TypeScriptStaticArrayMethods(),
			this.expression_names,
		);
		this.collected = new WeakSet<ts.SourceFile>();
	}
	/** Responsibilities: _public operation_. **/
	public value(expression: ts.Expression, source_file: ts.SourceFile): string {
		this.collect(source_file);
		const candidates = this.values.sequence(expression);
		if (candidates.size !== 1n) {
			return "";
		}
		const candidate = this.expression_aliases.unwrapped(candidates.at(0n));
		if (ts.isStringLiteral(candidate) || ts.isNoSubstitutionTemplateLiteral(candidate)) {
			return candidate.text;
		}
		return "";
	}

	/** Responsibilities: _resolution static array expressions_. **/
	public expressions(expression: ts.Expression, source_file: ts.SourceFile): readonly ts.Expression[] {
		this.collect(source_file);
		const expressions: ts.Expression[] = [];
		this.values.sequence(expression).append_to(expressions);
		return expressions;
	}
}
