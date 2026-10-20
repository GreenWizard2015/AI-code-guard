import { resolve as resolve_path } from "node:path";
import ts from "typescript";
import { TypeScriptDeclarationTable } from "src/module-resolution/type_script_declaration_table";
import { TypeScriptDeclarationIndex } from "src/module-resolution/type_script_declaration_index";
import { TypeScriptExportLinksTable } from "src/module-resolution/type_script_export_links_table";
import { TypeScriptLocalImportTable } from "src/module-resolution/type_script_local_import_table";
import { TypeScriptModulePathCatalog } from "src/module-resolution/type_script_module_path_catalog";
import { MODULE_CACHE_KEY_SEPARATOR, SHARED_MODULE_CACHES } from "src/constants";
import { TypeScriptProjectResolutionCache } from "src/module-resolution/type_script_project_resolution_cache";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { TypeScriptDeclarationsContract, TypeScriptExportLinksContract } from "src/module-resolution/protocols";
import type { TypeScriptDeclarationIndexContract } from "src/typescript_runtime_protocols";
import { ResolvedTypeScriptDeclarationKind } from "src/module-resolution/types";
import type {
	RecursiveExportResolver,
	TypeScriptLocalImportTableContract,
	ResolvedTypeScriptExport,
	TypeScriptModuleCache,
} from "src/module-resolution/types";

/** Responsibilities: _recursive module export resolution_, _symbol kind lookup_. **/
export class TypeScriptModuleExports implements RecursiveExportResolver {
	private readonly declarations: TypeScriptDeclarationsContract;
	private readonly declaration_index: TypeScriptDeclarationIndexContract;
	private readonly links: TypeScriptExportLinksContract;
	private readonly module_paths: TypeScriptModulePathCatalog;
	private readonly project_root: string;
	private readonly resolved_exports: Map<string, ResolvedTypeScriptExport>;
	private readonly module_symbols: Map<string, string>;
	private readonly module_cache: TypeScriptModuleCache;

	/** Responsibilities: _module import context_. **/
	private import_scope(file: string, module_name: string): string {
		if (module_name.startsWith(".")) {
			return file;
		}
		return this.project_root;
	}

	/** Responsibilities: _local imported binding table_. **/
	private local_import_table(source_file: ts.SourceFile): TypeScriptLocalImportTableContract {
		const cached = this.module_cache.local_import_indexes.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const table = new TypeScriptLocalImportTable(source_file);
		table.collect();
		this.module_cache.local_import_indexes.set(source_file, table);
		return table;
	}

	/** Responsibilities: _source export resolution_. **/
	private file_export_resolution(
		file: string,
		name: string,
		visited: Set<string>,
		cache_key: string,
	): ResolvedTypeScriptExport {
		if (!this.module_paths.source_available(file)) {
			return { file: "", name: "" };
		}
		const resolved = this.declarations.exported_symbol(file, name, this.module_paths.source_file(file), visited);
		if (resolved.file.length > 0) {
			this.resolved_exports.set(cache_key, resolved);
		}
		return resolved;
	}

	/** Responsibilities: _initialization recursive export module_. **/
	constructor(
		project_root: string,
		source_files: ReadonlyMap<string, ts.SourceFile>,
		filesystem_fallback: boolean,
		source_io: ProjectSourceIOContract,
	) {
		this.project_root = resolve_path(project_root);
		const cached = SHARED_MODULE_CACHES.get(source_files);
		if (cached !== undefined) {
			this.module_cache = cached;
		} else {
			const created: TypeScriptModuleCache = {
				module_symbols: new Map(),
				resolved_exports: new Map(),
				resolutions: new WeakMap(),
				declaration_indexes: new WeakMap(),
				default_declarations: new WeakMap(),
				export_assignments: new WeakMap(),
				exported_declarations: new WeakMap(),
				named_export_indexes: new WeakMap(),
				local_import_indexes: new WeakMap(),
				symbol_kinds: new WeakMap(),
			};
			SHARED_MODULE_CACHES.set(source_files, created);
			this.module_cache = created;
		}
		let project_resolutions = this.module_cache.resolutions.get(source_io);
		if (project_resolutions === undefined) {
			project_resolutions = new TypeScriptProjectResolutionCache(source_io);
			this.module_cache.resolutions.set(source_io, project_resolutions);
		}
		if (this.module_cache.symbol_kinds === undefined) {
			this.module_cache.symbol_kinds = new WeakMap();
		}
		const resolution = project_resolutions.resolution(this.project_root, filesystem_fallback);
		this.module_paths = new TypeScriptModulePathCatalog(
			this.project_root,
			source_files,
			filesystem_fallback,
			resolution,
			source_io,
		);
		this.module_symbols = this.module_cache.module_symbols;
		this.resolved_exports = this.module_cache.resolved_exports;
		this.links = new TypeScriptExportLinksTable(this, this, this.module_cache);
		this.declaration_index = new TypeScriptDeclarationIndex(this.module_cache);
		this.declarations = new TypeScriptDeclarationTable(this.declaration_index, this.links, this);
	}

	/** Responsibilities: _resolution source file import_. **/
	public file_for(file: string, name: string, visited: Set<string>): ResolvedTypeScriptExport {
		const visit_key = `${file}:${name}`;
		const cache_key = `${this.project_root}${MODULE_CACHE_KEY_SEPARATOR}${this.module_paths.policy_key()}${MODULE_CACHE_KEY_SEPARATOR}${file}${MODULE_CACHE_KEY_SEPARATOR}${name}`;
		const cached = this.resolved_exports.get(cache_key);
		if (cached !== undefined) {
			return cached;
		}
		if (visited.has(visit_key)) {
			return { file: "", name: "" };
		}
		visited.add(visit_key);
		return this.file_export_resolution(file, name, visited, cache_key);
	}

	/** Responsibilities: _resolution local symbol declaration_. **/
	public local_symbol(
		file: string,
		source_file: ts.SourceFile,
		name: string,
		visited: Set<string>,
	): ResolvedTypeScriptExport {
		const direct = this.declarations.direct_declaration(file, source_file, name, false);
		if (direct.file.length > 0) {
			return direct;
		}
		for (const binding of this.local_import_table(source_file).bindings_for(name)) {
			const resolved = this.links.imported_binding_name(file, binding.statement, binding.imported_name, visited);
			if (resolved.file.length > 0) {
				return resolved;
			}
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _resolution named export recursively_. **/
	public resolve(file: string, name: string): ResolvedTypeScriptExport {
		return this.file_for(file, name, new Set());
	}

	/** Responsibilities: _symbol kind_. **/
	public symbol_kind(file: string, name: string): ResolvedTypeScriptDeclarationKind {
		const resolved = this.resolve(file, name);
		if (resolved.file.length === 0) {
			return ResolvedTypeScriptDeclarationKind.Other;
		}
		if (!this.module_paths.source_available(resolved.file)) {
			return ResolvedTypeScriptDeclarationKind.Other;
		}
		return this.declaration_index.symbol_kind(this.module_paths.source_file(resolved.file), resolved.name);
	}

	/** Responsibilities: _resolution symbol represented module_. **/
	public module_symbol(file: string, module_name: string): string {
		const cache_key = `${this.project_root}${MODULE_CACHE_KEY_SEPARATOR}${this.module_paths.policy_key()}${MODULE_CACHE_KEY_SEPARATOR}${this.import_scope(file, module_name)}${MODULE_CACHE_KEY_SEPARATOR}${module_name}`;
		const cached = this.module_symbols.get(cache_key);
		if (cached !== undefined) {
			return cached;
		}
		for (const base of this.module_paths.bases(file, module_name)) {
			const candidate = this.module_paths.symbol(base);
			if (candidate.length > 0) {
				this.module_symbols.set(cache_key, candidate);
				return candidate;
			}
		}
		this.module_symbols.set(cache_key, "");
		return "";
	}
}
