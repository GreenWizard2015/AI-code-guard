import ts from "typescript";
import type { ModulePathResolver } from "src/module-resolution/types";
import type { SourceFileResolver } from "src/protocols";
import type {
	RestUnionAliasDeclarations,
	RestUnionResolverAliasCache,
	RestUnionSourceAliasCache,
	RestUnionPreparedAliasCache,
} from "src/rules/typescript/syntax-rules/types/types";

/** Responsibilities: _imported type alias resolution_, _rest-union declaration indexing_. **/
export class RestUnionImportedAliases {
	private readonly alias_cache: RestUnionSourceAliasCache;
	private readonly prepared_aliases: RestUnionPreparedAliasCache;

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
			const qualified_name_parts = [...namespace, node.name.text];
			aliases.set(qualified_name_parts.join("."), node);
		}
		node.forEachChild((child) => this.collect_aliases(child, namespace, aliases));
	}

	/** Responsibilities: _source alias indexing_. **/
	private alias_declarations(source_file: ts.SourceFile): RestUnionAliasDeclarations {
		const cached = this.alias_cache.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const aliases = new Map<string, ts.TypeAliasDeclaration>();
		source_file.forEachChild((node) => this.collect_aliases(node, [], aliases));
		this.alias_cache.set(source_file, aliases);
		return aliases;
	}

	/** Responsibilities: _imported alias naming_. **/
	private imported_name(element: ts.ImportSpecifier): string {
		if (element.propertyName !== undefined) {
			return element.propertyName.text;
		}
		return element.name.text;
	}

	/** Responsibilities: _source alias transfer_. **/
	private append_source_aliases(
		bindings: ts.NamedImports,
		imported_source: ts.SourceFile,
		aliases: Map<string, ts.TypeAliasDeclaration>,
	): void {
		const imported_aliases = this.alias_declarations(imported_source);
		for (const element of bindings.elements) {
			const declaration = imported_aliases.get(this.imported_name(element));
			if (declaration !== undefined) {
				aliases.set(element.name.text, declaration);
			}
		}
	}

	/** Responsibilities: _import module resolution_. **/
	private imported_file(
		source_file: ts.SourceFile,
		statement: ts.ImportDeclaration,
		module_path: ModulePathResolver,
	): string {
		if (!ts.isStringLiteral(statement.moduleSpecifier)) {
			return "";
		}
		return module_path.module_symbol(source_file.fileName, statement.moduleSpecifier.text);
	}

	/** Responsibilities: _declaration import resolution_. **/
	private append_declaration_aliases(
		source_file: ts.SourceFile,
		statement: ts.ImportDeclaration,
		module_path: ModulePathResolver,
		source_resolver: SourceFileResolver,
		aliases: Map<string, ts.TypeAliasDeclaration>,
	): void {
		const bindings = statement.importClause?.namedBindings;
		if (bindings === undefined) {
			return;
		}
		if (!ts.isNamedImports(bindings)) {
			return;
		}
		const imported_file = this.imported_file(source_file, statement, module_path);
		if (imported_file.length === 0) {
			return;
		}
		const imported_source = source_resolver.get(imported_file);
		if (imported_source === undefined) {
			return;
		}
		this.append_source_aliases(bindings, imported_source, aliases);
	}

	/** Responsibilities: _source resolver alias cache_. **/
	private resolver_cache(source_file: ts.SourceFile, module_path: ModulePathResolver): RestUnionResolverAliasCache {
		let by_module = this.prepared_aliases.get(source_file);
		if (by_module === undefined) {
			by_module = new WeakMap<ModulePathResolver, RestUnionResolverAliasCache>();
			this.prepared_aliases.set(source_file, by_module);
		}
		let by_resolver = by_module.get(module_path);
		if (by_resolver === undefined) {
			by_resolver = new WeakMap<SourceFileResolver, RestUnionAliasDeclarations>();
			by_module.set(module_path, by_resolver);
		}
		return by_resolver;
	}

	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.alias_cache = new WeakMap<ts.SourceFile, RestUnionAliasDeclarations>();
		this.prepared_aliases = new WeakMap();
	}

	/** Responsibilities: _source alias resolution_. **/
	public aliases_for(
		source_file: ts.SourceFile,
		module_path: ModulePathResolver,
		source_resolver: SourceFileResolver,
	): RestUnionAliasDeclarations {
		const cache = this.resolver_cache(source_file, module_path);
		const cached = cache.get(source_resolver);
		if (cached !== undefined) {
			return cached;
		}
		const aliases = new Map<string, ts.TypeAliasDeclaration>();
		this.append_local(source_file, aliases);
		this.append(source_file, module_path, source_resolver, aliases);
		cache.set(source_resolver, aliases);
		return aliases;
	}
	/** Responsibilities: _public operation_. **/
	public append(
		source_file: ts.SourceFile,
		module_path: ModulePathResolver,
		source_resolver: SourceFileResolver,
		aliases: Map<string, ts.TypeAliasDeclaration>,
	): void {
		for (const statement of source_file.statements) {
			if (ts.isImportDeclaration(statement)) {
				this.append_declaration_aliases(source_file, statement, module_path, source_resolver, aliases);
			}
		}
	}

	/** Responsibilities: _local alias transfer_. **/
	public append_local(source_file: ts.SourceFile, aliases: Map<string, ts.TypeAliasDeclaration>): void {
		for (const node of source_file.statements) {
			this.collect_aliases(node, [], aliases);
		}
	}
}
