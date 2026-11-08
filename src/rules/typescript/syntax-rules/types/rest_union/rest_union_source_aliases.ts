import type { ModulePathResolverContract } from "src/module-resolution/types";
import type {
	RestUnionAliasDeclarations,
	RestUnionSourceAliasCache,
	RestUnionSourceAliasesOptions,
} from "src/rules/typescript/syntax-rules/types/types";
import type { SourceFileResolver } from "src/source_types";
import ts from "typescript";

/** Responsibilities: _rest-union import resolution_, _rest-union alias indexing_. **/
export class RestUnionSourceAliases {
	private readonly _source_file: ts.SourceFile;
	private readonly _module_path: ModulePathResolverContract;
	private readonly _source_resolver: SourceFileResolver;
	private readonly _alias_cache: RestUnionSourceAliasCache;
	private readonly _local_aliases: RestUnionAliasDeclarations;

	/** Responsibilities: _nested alias collection_. **/
	private collect_aliases(
		node: ts.Node,
		namespace: readonly string[],
		aliases: Map<string, ts.TypeAliasDeclaration>,
	): void {
		if (ts.isModuleDeclaration(node)) {
			if (node.body !== undefined) {
				this.collect_aliases(node.body, [...namespace, node.name.getText()], aliases);
			}
			return;
		}
		if (ts.isTypeAliasDeclaration(node)) {
			const name_parts = [...namespace, node.name.text];
			aliases.set(name_parts.join("."), node);
		}
		node.forEachChild((child) => this.collect_aliases(child, namespace, aliases));
	}

	/** Responsibilities: _declaration alias cache_. **/
	private declarations(declaration_file: ts.SourceFile): RestUnionAliasDeclarations {
		const cached = this._alias_cache.get(declaration_file);
		if (cached !== undefined) {
			return cached;
		}
		const aliases = new Map<string, ts.TypeAliasDeclaration>();
		declaration_file.forEachChild((node) => this.collect_aliases(node, [], aliases));
		this._alias_cache.set(declaration_file, aliases);
		return aliases;
	}

	/** Responsibilities: _imported alias name resolution_. **/
	private imported_name(element: ts.ImportSpecifier): string {
		if (element.propertyName !== undefined) {
			return element.propertyName.text;
		}
		return element.name.text;
	}

	/** Responsibilities: _named imported alias indexing_. **/
	private aliases_from_source(bindings: ts.NamedImports, imported_source: ts.SourceFile): RestUnionAliasDeclarations {
		const imported_aliases = this.declarations(imported_source);
		const aliases = new Map<string, ts.TypeAliasDeclaration>();
		for (const element of bindings.elements) {
			const declaration = imported_aliases.get(this.imported_name(element));
			if (declaration !== undefined) {
				aliases.set(element.name.text, declaration);
			}
		}
		return aliases;
	}

	/** Responsibilities: _one import's alias resolution_. **/
	private aliases_from_bindings(bindings: ts.NamedImports, file: string): RestUnionAliasDeclarations {
		if (file.length === 0) {
			return new Map<string, ts.TypeAliasDeclaration>();
		}
		const source = this._source_resolver.get(file);
		if (source === undefined) {
			return new Map<string, ts.TypeAliasDeclaration>();
		}
		return this.aliases_from_source(bindings, source);
	}

	/** Responsibilities: _one import's alias resolution_. **/
	private aliases_from_import(statement: ts.ImportDeclaration): RestUnionAliasDeclarations {
		const import_clause = statement.importClause;
		if (import_clause === undefined) {
			return new Map<string, ts.TypeAliasDeclaration>();
		}
		const bindings = import_clause.namedBindings;
		if (bindings === undefined || !ts.isNamedImports(bindings)) {
			return new Map<string, ts.TypeAliasDeclaration>();
		}
		const module_specifier = statement.moduleSpecifier;
		if (!ts.isStringLiteral(module_specifier)) {
			return new Map<string, ts.TypeAliasDeclaration>();
		}
		const file = this._module_path.module_symbol(this._source_file.fileName, module_specifier.text);
		return this.aliases_from_bindings(bindings, file);
	}

	/** Responsibilities: _source alias resolver setup_. **/
	public constructor(options: RestUnionSourceAliasesOptions) {
		this._source_file = options.source_file;
		this._module_path = options.module_path;
		this._source_resolver = options.source_resolver;
		this._alias_cache = options.alias_cache;
		this._local_aliases = options.local_aliases;
	}

	/** Responsibilities: _imported alias index access_. **/
	public imported_aliases(): RestUnionAliasDeclarations {
		const aliases = new Map<string, ts.TypeAliasDeclaration>();
		for (const statement of this._source_file.statements) {
			if (ts.isImportDeclaration(statement)) {
				for (const [name, declaration] of this.aliases_from_import(statement)) {
					aliases.set(name, declaration);
				}
			}
		}
		return aliases;
	}

	/** Responsibilities: _source alias indexing_. **/
	public aliases(): RestUnionAliasDeclarations {
		const aliases = new Map(this._local_aliases);
		for (const [name, declaration] of this.imported_aliases()) {
			aliases.set(name, declaration);
		}
		return aliases;
	}
}
