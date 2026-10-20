import ts from "typescript";
import type { TypeScriptFactoryAliasesContract, TypeScriptFactoryArrayAliasesContract, TypeScriptFactoryObjectAliasesContract } from "src/typescript_runtime_protocols";
import { TypeScriptFactoryArrayAliases } from "src/linting/orchestration/runtime/typescript-singleton/type_script_factory_array_aliases";
import { TypeScriptFactoryObjectAliases } from "src/linting/orchestration/runtime/typescript-singleton/type_script_factory_object_aliases";
import { TypeScriptExpressionNames } from "src/typescript-aliases/type_script_expression_names";

/** Responsibilities: _factory source indexing_, _callable body lookup_. **/
export class TypeScriptFactoryAliases implements TypeScriptFactoryAliasesContract {
	private readonly expression_names: TypeScriptExpressionNames;
	private readonly source_file: ts.SourceFile;
	private readonly object_aliases: TypeScriptFactoryObjectAliasesContract;
	private readonly array_aliases: TypeScriptFactoryArrayAliasesContract;

	/** Responsibilities: _module variable collection_. **/
	private variable_declarations(): readonly ts.VariableDeclaration[] {
		const declarations: ts.VariableDeclaration[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isFunctionLike(node)) {
				return;
			}
			if (ts.isClassLike(node)) {
				return;
			}
			if (ts.isVariableDeclaration(node)) {
				declarations.push(node);
				return;
			}
			ts.forEachChild(node, visit);
		};
		visit(this.source_file);
		return declarations;
	}

	/** Responsibilities: _factory source identification_. **/
	private source_for(declaration: ts.VariableDeclaration, name: string): string {
		if (declaration.initializer === undefined) {
			return "";
		}
		const initializer = this.expression_names.unwrap_transparent_expression(declaration.initializer);
		if (ts.isIdentifier(declaration.name)) {
			if (declaration.name.text === name) {
				if (ts.isIdentifier(initializer)) {
					return initializer.text;
				}
			}
		}
		const object_source = this.object_aliases.source(declaration, name);
		if (object_source !== "") {
			return object_source;
		}
		return this.array_aliases.source(declaration, name);
	}

	/** Responsibilities: _collection direct factory names_. **/
	private append_direct_names(names: Set<string>): void {
		for (const declaration of this.variable_declarations()) {
			if (!ts.isIdentifier(declaration.name)) {
				continue;
			}
			if (this.source_for(declaration, declaration.name.text) !== "") {
				names.add(declaration.name.text);
			}
		}
	}

	/** Responsibilities: _collection declared factory names_. **/
	private append_function_names(names: Set<string>): void {
		const visit = (node: ts.Node): void => {
			if (ts.isFunctionDeclaration(node)) {
				if (node.name !== undefined) {
					names.add(node.name.text);
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(this.source_file);
	}

	/** Responsibilities: _initialization TypeScript factory aliases_. **/
	public constructor(source_file: ts.SourceFile) {
		this.expression_names = new TypeScriptExpressionNames();
		this.source_file = source_file;
		this.object_aliases = new TypeScriptFactoryObjectAliases(source_file);
		this.array_aliases = new TypeScriptFactoryArrayAliases(source_file);
	}

	/** Responsibilities: _collection factory alias names_. **/
	public names(): ReadonlySet<string> {
		const names = new Set<string>();
		this.append_direct_names(names);
		for (const name of this.object_aliases.names()) {
			names.add(name);
		}
		for (const name of this.array_aliases.names()) {
			names.add(name);
		}
		this.append_function_names(names);
		return names;
	}

	/** Responsibilities: _resolution factory alias sources_. **/
	public sources(name: string): readonly string[] {
		const sources: string[] = [];
		for (const declaration of this.variable_declarations()) {
			const source = this.source_for(declaration, name);
			if (source !== "") {
				sources.push(source);
			}
		}
		return sources;
	}

	/** Responsibilities: _collection inline factory bodies_. **/
	public inline_bodies(name: string): readonly ts.FunctionLikeDeclarationBase[] {
		const bodies = new Map<string, ts.FunctionLikeDeclarationBase>();
		for (const declaration of this.variable_declarations()) {
			this.object_aliases.append_expression(declaration, name, bodies);
			for (const expression of this.array_aliases.expressions(declaration, name).values()) {
				bodies.set(name, expression);
			}
		}
		return [...bodies.values()];
	}

	/** Responsibilities: _resolution property factory bodies_. **/
	public property_bodies(expression: ts.Expression): readonly ts.FunctionLikeDeclarationBase[] {
		const bodies = this.object_aliases.property_bodies(expression);
		const unique = new Map<number, ts.FunctionLikeDeclarationBase>();
		for (const body of bodies) {
			unique.set(body.getStart(this.source_file), body);
		}
		return [...unique.values()];
	}
}
