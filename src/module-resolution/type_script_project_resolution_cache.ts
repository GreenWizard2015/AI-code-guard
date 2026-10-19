import { resolve as resolve_path } from "node:path";
import {
	MODULE_CACHE_DISK_SCOPE,
	MODULE_CACHE_KEY_SEPARATOR,
	MODULE_CACHE_SNAPSHOT_SCOPE,
} from "src/module-resolution/constants";
import { TypeScriptProjectResolution } from "src/module-resolution/type_script_project_resolution";
import type {
	TypeScriptModuleResolutionContract,
	TypeScriptProjectResolutionCacheContract,
} from "src/module-resolution/types";
import type { ProjectSourceIOContract } from "src/protocols";

/** Responsibilities: _project resolution caching_, _cache scope selection_. **/
export class TypeScriptProjectResolutionCache implements TypeScriptProjectResolutionCacheContract {
	private readonly resolutions: Map<string, TypeScriptModuleResolutionContract>;
	private readonly source_io: ProjectSourceIOContract;

	/** Responsibilities: _cache state initialization_. **/
	public constructor(source_io: ProjectSourceIOContract) {
		this.resolutions = new Map<string, TypeScriptModuleResolutionContract>();
		this.source_io = source_io;
	}

	/** Responsibilities: _cached project resolution_. **/
	public resolution(project_root: string, filesystem_fallback: boolean): TypeScriptModuleResolutionContract {
		let scope = MODULE_CACHE_SNAPSHOT_SCOPE;
		if (filesystem_fallback) {
			scope = MODULE_CACHE_DISK_SCOPE;
		}
		const cache_key = `${resolve_path(project_root)}${MODULE_CACHE_KEY_SEPARATOR}${scope}`;
		const cached = this.resolutions.get(cache_key);
		if (cached !== undefined) {
			return cached;
		}
		const project_resolution = new TypeScriptProjectResolution(project_root, this.source_io);
		const resolution = project_resolution.resolution();
		this.resolutions.set(cache_key, resolution);
		return resolution;
	}
}
