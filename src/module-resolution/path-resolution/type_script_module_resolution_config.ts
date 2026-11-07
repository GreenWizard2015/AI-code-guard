import { resolve as resolve_path } from "node:path";
import { MODULE_CACHE_DISK_SCOPE, MODULE_CACHE_SNAPSHOT_SCOPE } from "src/constants";
import type {
	TypeScriptModuleResolutionContract,
	TypeScriptModuleResolutionOptions,
	TypeScriptPathMapping,
} from "src/module-resolution/types";

/** Responsibilities: _path mapping expansion_, _resolution policy identity_. **/
export class TypeScriptModuleResolutionConfig implements TypeScriptModuleResolutionContract {
	private readonly _options: TypeScriptModuleResolutionOptions;
	private readonly _cache_key: string;
	private readonly _wildcard_mappings: readonly TypeScriptPathMapping[];

	/** Responsibilities: _mapping pattern matching_. **/
	private mapping_matches(candidate_specifier: string, mapping: TypeScriptPathMapping): boolean {
		const wildcard = mapping.pattern.indexOf("*");
		if (wildcard < 0) {
			return candidate_specifier === mapping.pattern;
		}
		const prefix = mapping.pattern.slice(0, wildcard);
		const suffix = mapping.pattern.slice(wildcard + 1);
		if (!candidate_specifier.startsWith(prefix)) {
			return false;
		}
		if (!candidate_specifier.endsWith(suffix)) {
			return false;
		}
		const suffix_start = candidate_specifier.length - suffix.length;
		return suffix_start >= prefix.length;
	}

	/** Responsibilities: _wildcard suffix extraction_. **/
	private mapping_suffix(matched_specifier: string, mapping: TypeScriptPathMapping): string {
		const wildcard = mapping.pattern.indexOf("*");
		if (wildcard < 0) {
			return "";
		}
		const prefix_length = wildcard;
		const suffix_length = mapping.pattern.length - wildcard - 1;
		return matched_specifier.slice(prefix_length, matched_specifier.length - suffix_length);
	}

	/** Responsibilities: _matching path mapping lookup_. **/
	private configured_mapping(requested_specifier: string): TypeScriptPathMapping[] {
		for (const mapping of this._options.paths) {
			if (mapping.pattern === requested_specifier) {
				return [mapping];
			}
		}
		for (const mapping of this._wildcard_mappings) {
			if (this.mapping_matches(requested_specifier, mapping)) {
				return [mapping];
			}
		}
		return [];
	}

	/** Responsibilities: _resolution configuration initialization_. **/
	public constructor(options: TypeScriptModuleResolutionOptions, cache_key: string) {
		this._options = options;
		this._cache_key = cache_key;
		this._wildcard_mappings = options.paths
			.filter((mapping) => mapping.pattern.includes("*"))
			.slice()
			.sort((left, right) => right.pattern.indexOf("*") - left.pattern.indexOf("*"));
	}

	/** Responsibilities: _non-relative module bases_. **/
	public non_relative_bases(module_name: string): string[] {
		const bases: string[] = [];
		for (const mapping of this.configured_mapping(module_name)) {
			const suffix = this.mapping_suffix(module_name, mapping);
			bases.push(...mapping.targets.map((target) => resolve_path(mapping.base_path, target.replace("*", suffix))));
		}
		bases.push(resolve_path(this._options.base_url, module_name));
		return [...new Set(bases)];
	}

	/** Responsibilities: _path alias classification_. **/
	public path_alias_configured(alias_specifier: string): boolean {
		return this.configured_mapping(alias_specifier).length > 0;
	}

	/** Responsibilities: _resolution cache policy identity_. **/
	public policy_key(filesystem_fallback: boolean): string {
		let source = MODULE_CACHE_SNAPSHOT_SCOPE;
		if (filesystem_fallback) {
			source = MODULE_CACHE_DISK_SCOPE;
		}
		return `${source}:${this._cache_key}`;
	}
}
