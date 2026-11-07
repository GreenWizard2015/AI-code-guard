import type { TypeScriptModuleExportScopeContract } from "src/module-resolution/protocols";
import type { TypeScriptExportLookupOptions } from "src/module-resolution/protocols";
import type {
	ModulePathResolverContract,
	TypeScriptModuleCache,
	TypeScriptModuleSymbolReference,
	TypeScriptNamedExportIndex,
	TypeScriptNamedExportLink,
} from "src/module-resolution/types";
import ts from "typescript";

/** Responsibilities: _named export resolution_, _star export traversal_. **/
export class TypeScriptExportLookup {
	private readonly _file: string;
	private readonly _source_file: ts.SourceFile;
	private readonly _name: string;
	private readonly _visited: Set<string>;
	private readonly _resolver: TypeScriptModuleExportScopeContract;
	private readonly _module_paths: ModulePathResolverContract;
	private readonly _module_cache: TypeScriptModuleCache;

	/** Responsibilities: _named export link addition_. **/
	private append_link(index: Map<string, TypeScriptNamedExportLink[]>, link: TypeScriptNamedExportLink): void {
		const links = index.get(link.element.name.text);
		if (links === undefined) {
			index.set(link.element.name.text, [link]);
			return;
		}
		links.push(link);
	}

	/** Responsibilities: _named export statement indexing_. **/
	private append_statement(index: Map<string, TypeScriptNamedExportLink[]>, statement: ts.Statement): void {
		if (!ts.isExportDeclaration(statement)) {
			return;
		}
		const export_clause = statement.exportClause;
		if (export_clause === undefined || !ts.isNamedExports(export_clause)) {
			return;
		}
		for (const element of export_clause.elements) {
			this.append_link(index, { statement, element });
		}
	}

	/** Responsibilities: _named export index construction_. **/
	private named_export_index(): TypeScriptNamedExportIndex {
		const cached = this._module_cache.named_export_indexes.get(this._source_file);
		if (cached !== undefined) {
			return cached;
		}
		const index = new Map<string, TypeScriptNamedExportLink[]>();
		for (const statement of this._source_file.statements) {
			this.append_statement(index, statement);
		}
		this._module_cache.named_export_indexes.set(this._source_file, index);
		return index;
	}

	/** Responsibilities: _named export target resolution_. **/
	private named_element_target(link: TypeScriptNamedExportLink): TypeScriptModuleSymbolReference {
		let source_name = link.element.name.text;
		if (link.element.propertyName !== undefined) {
			source_name = link.element.propertyName.text;
		}
		const module_specifier = link.statement.moduleSpecifier;
		if (module_specifier === undefined || !ts.isStringLiteral(module_specifier)) {
			return this._resolver.local_symbol({
				reference: { file: this._file, name: source_name },
				source_file: this._source_file,
				visited: this._visited,
			});
		}
		return this.imported_symbol(module_specifier.text, source_name);
	}

	/** Responsibilities: _star export target resolution_. **/
	private star_statement(statement: ts.ExportDeclaration): TypeScriptModuleSymbolReference {
		const module_specifier = statement.moduleSpecifier;
		if (module_specifier === undefined || !ts.isStringLiteral(module_specifier)) {
			return { file: "", name: "" };
		}
		return this.imported_symbol(module_specifier.text, this._name);
	}

	/** Responsibilities: _imported symbol traversal_. **/
	private imported_symbol(module_specifier: string, name: string): TypeScriptModuleSymbolReference {
		const imported_file = this._module_paths.module_symbol(this._file, module_specifier);
		if (imported_file.length === 0) {
			return { file: "", name: "" };
		}
		return this._resolver.file_for({
			reference: { file: imported_file, name },
			visited: this._visited,
		});
	}

	/** Responsibilities: _export lookup initialization_. **/
	public constructor(options: TypeScriptExportLookupOptions) {
		this._file = options.file;
		this._source_file = options.source_file;
		this._name = options.name;
		this._visited = options.visited;
		this._resolver = options.resolver;
		this._module_paths = options.module_paths;
		this._module_cache = options.module_cache;
	}

	/** Responsibilities: _named export traversal_. **/
	public named_target(): TypeScriptModuleSymbolReference {
		const links = this.named_export_index().get(this._name);
		if (links === undefined) {
			return { file: "", name: "" };
		}
		for (const link of links) {
			const resolved = this.named_element_target(link);
			if (resolved.file.length > 0) {
				return resolved;
			}
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _star export traversal_. **/
	public star_target(): TypeScriptModuleSymbolReference {
		for (const statement of this._source_file.statements) {
			if (!ts.isExportDeclaration(statement) || statement.exportClause !== undefined) {
				continue;
			}
			const resolved = this.star_statement(statement);
			if (resolved.file.length > 0) {
				return resolved;
			}
		}
		return { file: "", name: "" };
	}
}
