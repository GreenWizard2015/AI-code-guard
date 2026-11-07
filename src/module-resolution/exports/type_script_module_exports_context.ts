import { resolve as resolve_path } from "node:path";
import { SHARED_MODULE_CACHES } from "src/constants";
import { TypeScriptModuleExports } from "src/module-resolution/exports/type_script_module_exports";
import { TypeScriptModulePathCatalog } from "src/module-resolution/path-resolution/type_script_module_path_catalog";
import { TypeScriptProjectResolutionCache } from "src/module-resolution/project-resolution/type_script_project_resolution_cache";
import type { TypeScriptModulePathCatalogContract } from "src/module-resolution/protocols";
import type {
	TypeScriptModuleCache,
	TypeScriptModuleExportsContract,
	TypeScriptProjectResolutionCacheContract,
} from "src/module-resolution/types";
import type { TypeScriptSourceFileMap } from "src/module-resolution/types";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _module resolution context_, _module export resolver assembly_. **/
export class TypeScriptModuleExportsContext {
	private readonly _project_root: string;
	private readonly _source_files: TypeScriptSourceFileMap;
	private readonly _filesystem_fallback: boolean;
	private readonly _source_io: ProjectSourceIOContract;

	/** Responsibilities: _shared cache lookup_. **/
	private module_cache(): TypeScriptModuleCache {
		const source_files = this._source_files;
		let source_caches = SHARED_MODULE_CACHES.get(source_files);
		if (source_caches === undefined) {
			source_caches = new WeakMap<ProjectSourceIOContract, TypeScriptModuleCache>();
			SHARED_MODULE_CACHES.set(source_files, source_caches);
		}
		let cache = source_caches.get(this._source_io);
		if (cache === undefined) {
			cache = this.create_module_cache();
			source_caches.set(this._source_io, cache);
		}
		return cache;
	}

	/** Responsibilities: _module cache initialization_. **/
	private create_module_cache(): TypeScriptModuleCache {
		return {
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
	}

	/** Responsibilities: _project resolution cache lookup_. **/
	private project_resolution(module_cache: TypeScriptModuleCache): TypeScriptProjectResolutionCacheContract {
		let resolution = module_cache.resolutions.get(this._source_io);
		if (resolution === undefined) {
			resolution = new TypeScriptProjectResolutionCache(this._source_io);
			module_cache.resolutions.set(this._source_io, resolution);
		}
		return resolution;
	}

	/** Responsibilities: _module resolution context storage_. **/
	public constructor(
		project_root: string,
		source_files: TypeScriptSourceFileMap,
		filesystem_fallback: boolean,
		source_io: ProjectSourceIOContract,
	) {
		this._project_root = project_root;
		this._source_files = source_files;
		this._filesystem_fallback = filesystem_fallback;
		this._source_io = source_io;
	}

	/** Responsibilities: _module path catalog creation_. **/
	public module_paths(): TypeScriptModulePathCatalogContract {
		const module_cache = this.module_cache();
		const root = resolve_path(this._project_root);
		const resolution = this.project_resolution(module_cache).resolution(root, this._filesystem_fallback);
		return new TypeScriptModulePathCatalog(
			root,
			this._source_files,
			this._filesystem_fallback,
			resolution,
			this._source_io,
		);
	}

	/** Responsibilities: _module exports resolver access_. **/
	public module_exports(): TypeScriptModuleExportsContract {
		const module_cache = this.module_cache();
		return new TypeScriptModuleExports({
			project_root: resolve_path(this._project_root),
			module_paths: this.module_paths(),
			module_cache,
		});
	}
}
