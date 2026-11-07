import { MODULE_CACHE_KEY_SEPARATOR } from "src/constants";
import { TypeScriptDeclarationTable } from "src/module-resolution/declarations/type_script_declaration_table";
import { TypeScriptLocalImportTable } from "src/module-resolution/declarations/type_script_local_import_table";
import { TypeScriptExportLinksTable } from "src/module-resolution/exports/type_script_export_links_table";
import type { TypeScriptDeclarationsContract, TypeScriptExportLinksContract } from "src/module-resolution/protocols";
import type {
	TypeScriptModuleExportScopeContract,
	TypeScriptModulePathCatalogContract,
} from "src/module-resolution/protocols";
import type {
	TypeScriptDirectDeclarationQuery,
	TypeScriptExportedSymbolQuery,
	TypeScriptFileExportQuery,
	TypeScriptLocalImportTableContract,
	TypeScriptLocalSymbolQuery,
	TypeScriptModuleCache,
	TypeScriptModuleSymbolReference,
} from "src/module-resolution/types";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import type { TypeScriptDeclarationIndexContract } from "src/typescript_runtime_protocols";
import type ts from "typescript";

/** Responsibilities: _recursive export traversal_, _local import resolution_. **/
export class TypeScriptModuleExportScope implements TypeScriptModuleExportScopeContract {
	private readonly _declarations: TypeScriptDeclarationsContract;
	private readonly _links: TypeScriptExportLinksContract;
	private readonly _module_paths: TypeScriptModulePathCatalogContract;
	private readonly _cache_prefix: string;
	private readonly _resolved_exports: Map<string, TypeScriptModuleSymbolReference>;
	private readonly _module_cache: TypeScriptModuleCache;

	/** Responsibilities: _local import binding cache_. **/
	private local_import_table(source_file: ts.SourceFile): TypeScriptLocalImportTableContract {
		const cached = this._module_cache.local_import_indexes.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const table = new TypeScriptLocalImportTable(source_file);
		table.collect();
		this._module_cache.local_import_indexes.set(source_file, table);
		return table;
	}

	/** Responsibilities: _source export resolution_. **/
	private file_export_resolution(
		file: string,
		name: string,
		visited: Set<string>,
		cache_key: string,
	): TypeScriptModuleSymbolReference {
		const module_source = this._module_paths.source(file);
		if (!module_source.available()) {
			return { file: "", name: "" };
		}
		const declaration = { file, name, source_file: module_source.source_file() };
		const export_query: TypeScriptExportedSymbolQuery = { declaration, visited };
		const resolved = this._declarations.exported_symbol(export_query);
		if (resolved.file.length > 0) {
			this._resolved_exports.set(cache_key, resolved);
		}
		return resolved;
	}

	/** Responsibilities: _recursive resolver initialization_. **/
	public constructor(
		project_root: string,
		module_paths: TypeScriptModulePathCatalogContract,
		module_resolver: TypeScriptModuleExportsContract,
		module_cache: TypeScriptModuleCache,
		declaration_index: TypeScriptDeclarationIndexContract,
	) {
		this._module_paths = module_paths;
		this._cache_prefix = `${project_root}${MODULE_CACHE_KEY_SEPARATOR}${module_paths.policy_key()}${MODULE_CACHE_KEY_SEPARATOR}`;
		this._module_cache = module_cache;
		this._resolved_exports = module_cache.resolved_exports;
		this._links = new TypeScriptExportLinksTable(this, module_resolver, module_cache);
		this._declarations = new TypeScriptDeclarationTable(declaration_index, this._links, this);
	}

	/** Responsibilities: _source file export lookup_. **/
	public file_for(query: TypeScriptFileExportQuery): TypeScriptModuleSymbolReference {
		const { reference, visited } = query;
		const { file, name } = reference;
		const visit_key = `${file}:${name}`;
		const cache_key = `${this._cache_prefix}${file}${MODULE_CACHE_KEY_SEPARATOR}${name}`;
		const cached = this._resolved_exports.get(cache_key);
		if (cached !== undefined) {
			return cached;
		}
		if (visited.has(visit_key)) {
			return { file: "", name: "" };
		}
		visited.add(visit_key);
		return this.file_export_resolution(file, name, visited, cache_key);
	}

	/** Responsibilities: _local symbol resolution_. **/
	public local_symbol(query: TypeScriptLocalSymbolQuery): TypeScriptModuleSymbolReference {
		const { reference, source_file, visited } = query;
		const { file, name } = reference;
		const declaration = { file, source_file, name };
		const declaration_query: TypeScriptDirectDeclarationQuery = { declaration, require_export: false };
		const direct = this._declarations.direct_declaration(declaration_query);
		if (direct.file.length > 0) {
			return direct;
		}
		for (const binding of this.local_import_table(source_file).bindings_for(name)) {
			const resolved = this._links.imported_binding_name(file, binding.statement, binding.imported_name, visited);
			if (resolved.file.length > 0) {
				return resolved;
			}
		}
		return { file: "", name: "" };
	}
}
