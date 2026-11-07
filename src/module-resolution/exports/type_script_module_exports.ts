import { MODULE_CACHE_KEY_SEPARATOR } from "src/constants";
import { TypeScriptDeclarationIndex } from "src/module-resolution/declarations/type_script_declaration_index";
import { TypeScriptModuleExportScope } from "src/module-resolution/exports/type_script_module_export_scope";
import type {
	TypeScriptModuleExportScopeContract,
	TypeScriptModuleExportsInitialization,
	TypeScriptModulePathCatalogContract,
} from "src/module-resolution/protocols";
import { ResolvedTypeScriptDeclarationKind } from "src/module-resolution/types";
import type {
	TypeScriptModuleExportsContract,
	TypeScriptModuleSymbolNameCache,
	TypeScriptModuleSymbolReference,
	TypeScriptModuleSymbolScopeCache,
} from "src/module-resolution/types";

/** Responsibilities: _module export resolution_, _module symbol lookup_. **/
export class TypeScriptModuleExports implements TypeScriptModuleExportsContract {
	private readonly _project_root: string;
	private readonly _cache_prefix: string;
	private readonly _module_paths: TypeScriptModulePathCatalogContract;
	private readonly _module_symbols: TypeScriptModuleSymbolScopeCache;
	private readonly _resolved_exports: Map<string, TypeScriptModuleSymbolReference>;
	private readonly _declaration_index: TypeScriptDeclarationIndex;
	private readonly _export_scope: TypeScriptModuleExportScopeContract;

	/** Responsibilities: _module import scope_. **/
	private import_scope(file: string, module_name: string): string {
		if (module_name.startsWith(".")) {
			return file;
		}
		return this._project_root;
	}

	/** Responsibilities: _module symbol scope cache_. **/
	private module_names(scope: string): TypeScriptModuleSymbolNameCache {
		let names = this._module_symbols.get(scope);
		if (names === undefined) {
			names = new Map();
			this._module_symbols.set(scope, names);
		}
		return names;
	}

	/** Responsibilities: _module symbol candidate lookup_. **/
	private module_symbol_candidate(
		names: TypeScriptModuleSymbolNameCache,
		specifier: string,
		bases: readonly string[],
	): string {
		for (const base of bases) {
			const candidate = this._module_paths.symbol(base);
			if (candidate.length > 0) {
				names.set(specifier, candidate);
				return candidate;
			}
		}
		names.set(specifier, "");
		return "";
	}

	/** Responsibilities: _module resolver dependency storage_. **/
	public constructor(options: TypeScriptModuleExportsInitialization) {
		this._project_root = options.project_root;
		this._module_paths = options.module_paths;
		this._cache_prefix = `${options.project_root}${MODULE_CACHE_KEY_SEPARATOR}${options.module_paths.policy_key()}${MODULE_CACHE_KEY_SEPARATOR}`;
		let module_symbol_scopes = options.module_cache.module_symbols.get(this._cache_prefix);
		if (module_symbol_scopes === undefined) {
			module_symbol_scopes = new Map();
			options.module_cache.module_symbols.set(this._cache_prefix, module_symbol_scopes);
		}
		this._module_symbols = module_symbol_scopes;
		this._resolved_exports = options.module_cache.resolved_exports;
		this._declaration_index = new TypeScriptDeclarationIndex(options.module_cache);
		this._export_scope = new TypeScriptModuleExportScope(
			this._project_root,
			this._module_paths,
			this,
			options.module_cache,
			this._declaration_index,
		);
	}

	/** Responsibilities: _export target identity_. **/
	public resolve(reference: TypeScriptModuleSymbolReference): TypeScriptModuleSymbolReference {
		const cache_key = `${this._cache_prefix}${reference.file}${MODULE_CACHE_KEY_SEPARATOR}${reference.name}`;
		const cached = this._resolved_exports.get(cache_key);
		if (cached !== undefined) {
			return cached;
		}
		return this._export_scope.file_for({ reference, visited: new Set() });
	}

	/** Responsibilities: _export declaration kind_. **/
	public symbol_kind(resolved: TypeScriptModuleSymbolReference): ResolvedTypeScriptDeclarationKind {
		if (resolved.file.length === 0) {
			return ResolvedTypeScriptDeclarationKind.Other;
		}
		const source = this._module_paths.source(resolved.file);
		if (!source.available()) {
			return ResolvedTypeScriptDeclarationKind.Other;
		}
		return this._declaration_index.symbol_kind(source.source_file(), resolved.name);
	}

	/** Responsibilities: _module symbol path_. **/
	public module_symbol(file: string, module_name: string): string {
		const names = this.module_names(this.import_scope(file, module_name));
		const cached = names.get(module_name);
		if (cached !== undefined) {
			return cached;
		}
		return this.module_symbol_candidate(names, module_name, this._module_paths.bases(file, module_name));
	}
}
