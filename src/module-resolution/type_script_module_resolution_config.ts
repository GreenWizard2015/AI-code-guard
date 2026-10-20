import { resolve as resolve_path } from "node:path";
import { MODULE_CACHE_DISK_SCOPE, MODULE_CACHE_SNAPSHOT_SCOPE } from "src/constants";
import type {
	TypeScriptModuleResolutionContract,
	TypeScriptModuleResolutionOptions,
	TypeScriptPathMapping,
	TypeScriptPathMappingMatch,
} from "src/module-resolution/types";

/** Responsibilities: _path mapping expansion_, _resolution policy identity_. **/
export class TypeScriptModuleResolutionConfig implements TypeScriptModuleResolutionContract {
	private readonly options: TypeScriptModuleResolutionOptions;
	private readonly cache_key: string;
	private readonly wildcard_mappings: readonly TypeScriptPathMapping[];

	/** Responsibilities: _mapping wildcard extraction_. **/
	private mapping_parts(mapping: TypeScriptPathMapping, module_name: string): TypeScriptPathMappingMatch {
		const wildcard = mapping.pattern.indexOf("*");
		if (wildcard < 0) {
			return { matched: module_name === mapping.pattern, suffix: "" };
		}
		const prefix = mapping.pattern.slice(0, wildcard);
		const suffix = mapping.pattern.slice(wildcard + 1);
		const suffix_start = module_name.length - suffix.length;
		const matched = suffix_start >= prefix.length && module_name.startsWith(prefix) && module_name.endsWith(suffix);
		let value = "";
		if (matched) {
			value = module_name.slice(prefix.length, suffix_start);
		}
		return { matched, suffix: value };
	}

	/** Responsibilities: _mapping target paths_. **/
	private mapping_targets(mapping: TypeScriptPathMapping, module_name: string): string[] {
		const match = this.mapping_parts(mapping, module_name);
		if (!match.matched) {
			return [];
		}
		return mapping.targets.map((target) => resolve_path(this.options.paths_base, target.replace("*", match.suffix)));
	}

	/** Responsibilities: _compiler-compatible path mapping selection_. **/
	private selected_mappings(module_name: string): TypeScriptPathMapping[] {
		const exact = this.options.paths.find((mapping) => mapping.pattern === module_name);
		if (exact !== undefined) {
			return [exact];
		}
		const wildcard = this.wildcard_mappings.find((mapping) => this.mapping_parts(mapping, module_name).matched);
		if (wildcard === undefined) {
			return [];
		}
		return [wildcard];
	}

	/** Responsibilities: _resolution configuration initialization_. **/
	public constructor(options: TypeScriptModuleResolutionOptions, cache_key: string) {
		this.options = options;
		this.cache_key = cache_key;
		this.wildcard_mappings = options.paths
			.filter((mapping) => mapping.pattern.includes("*"))
			.slice()
			.sort((left, right) => right.pattern.indexOf("*") - left.pattern.indexOf("*"));
	}

	/** Responsibilities: _module base paths_. **/
	public mapped_bases(module_name: string): string[] {
		for (const mapping of this.selected_mappings(module_name)) {
			return this.mapping_targets(mapping, module_name);
		}
		return [];
	}

	/** Responsibilities: _path alias classification_. **/
	public path_alias_configured(module_name: string): boolean {
		return this.selected_mappings(module_name).length > 0;
	}

	/** Responsibilities: _resolution cache policy identity_. **/
	public policy_key(filesystem_fallback: boolean): string {
		let source = MODULE_CACHE_SNAPSHOT_SCOPE;
		if (filesystem_fallback) {
			source = MODULE_CACHE_DISK_SCOPE;
		}
		return `${source}:${this.cache_key}`;
	}
}
