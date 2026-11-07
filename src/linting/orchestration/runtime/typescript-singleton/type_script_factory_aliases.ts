import { TypeScriptFactoryArrayAliases } from "src/linting/orchestration/runtime/typescript-singleton/factory-arrays/type_script_factory_array_aliases";
import { TypeScriptFactoryAliasLookup } from "src/linting/orchestration/runtime/typescript-singleton/type_script_factory_alias_lookup";
import { TypeScriptFactoryObjectAliases } from "src/linting/orchestration/runtime/typescript-singleton/type_script_factory_object_aliases";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type {
	TypeScriptFactoryAliasesContract,
	TypeScriptFactoryArrayAliasesContract,
	TypeScriptFactoryObjectAliasesContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _factory source indexing_, _callable body lookup_. **/
export class TypeScriptFactoryAliases implements TypeScriptFactoryAliasesContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _source_file: ts.SourceFile;
	private readonly _object_aliases: TypeScriptFactoryObjectAliasesContract;
	private readonly _array_aliases: TypeScriptFactoryArrayAliasesContract;

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
		visit(this._source_file);
		return declarations;
	}

	/** Responsibilities: _collection direct factory names_. **/
	private append_direct_names(names: Set<string>): void {
		for (const declaration of this.variable_declarations()) {
			if (!ts.isIdentifier(declaration.name)) {
				continue;
			}
			const lookup = new TypeScriptFactoryAliasLookup({
				name: declaration.name.text,
				expression_names: this._expression_names,
				object_aliases: this._object_aliases,
				array_aliases: this._array_aliases,
			});
			if (lookup.source(declaration) !== "") {
				names.add(declaration.name.text);
			}
		}
	}

	/** Responsibilities: _collection declared factory names_. **/
	private append_function_names(names: Set<string>): void {
		const visit = (node: ts.Node): void => {
			if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
				names.add(node.name.text);
			}
			ts.forEachChild(node, visit);
		};
		visit(this._source_file);
	}

	/** Responsibilities: _initialization TypeScript factory aliases_. **/
	public constructor(source_file: ts.SourceFile) {
		this._expression_names = new TypeScriptExpressionNames();
		this._source_file = source_file;
		this._object_aliases = new TypeScriptFactoryObjectAliases(source_file);
		this._array_aliases = new TypeScriptFactoryArrayAliases(source_file);
	}

	/** Responsibilities: _collection factory alias names_. **/
	public names(): ReadonlySet<string> {
		const names = new Set<string>();
		this.append_direct_names(names);
		for (const name of this._object_aliases.names()) {
			names.add(name);
		}
		for (const name of this._array_aliases.names()) {
			names.add(name);
		}
		this.append_function_names(names);
		return names;
	}

	/** Responsibilities: _resolution factory alias sources_. **/
	public sources(name: string): readonly string[] {
		const sources: string[] = [];
		const lookup = new TypeScriptFactoryAliasLookup({
			name,
			expression_names: this._expression_names,
			object_aliases: this._object_aliases,
			array_aliases: this._array_aliases,
		});
		for (const declaration of this.variable_declarations()) {
			const source = lookup.source(declaration);
			if (source !== "") {
				sources.push(source);
			}
		}
		return sources;
	}

	/** Responsibilities: _collection inline factory bodies_. **/
	public inline_bodies(name: string): readonly ts.FunctionLikeDeclarationBase[] {
		const bodies = new Map<string, ts.FunctionLikeDeclarationBase>();
		const lookup = new TypeScriptFactoryAliasLookup({
			name,
			expression_names: this._expression_names,
			object_aliases: this._object_aliases,
			array_aliases: this._array_aliases,
		});
		for (const declaration of this.variable_declarations()) {
			lookup.append_body(declaration, bodies);
		}
		return [...bodies.values()];
	}

	/** Responsibilities: _resolution property factory bodies_. **/
	public property_bodies(expression: ts.Expression): readonly ts.FunctionLikeDeclarationBase[] {
		const bodies = this._object_aliases.property_bodies(expression);
		const unique = new Map<number, ts.FunctionLikeDeclarationBase>();
		for (const body of bodies) {
			unique.set(body.getStart(this._source_file), body);
		}
		return [...unique.values()];
	}
}
