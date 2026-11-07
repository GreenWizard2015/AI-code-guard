import { SHARED_PARAMETER_REFERENCE_KIND } from "src/metrics/constants";
import type {
	SharedParameterKind,
	SharedParameterTypeIdentityContract,
	SharedParameterTypeSource,
} from "src/metrics/types";
import type { TypeSyntaxSegment } from "src/metrics/types";

/** Responsibilities: _parameter type syntax_, _source-scoped type identity_. **/
export class SharedParameterTypeIdentity implements SharedParameterTypeIdentityContract {
	private readonly _segments: readonly TypeSyntaxSegment[];
	private readonly _aliases: ReadonlyMap<string, string>;

	/** Responsibilities: _type reference alias resolution_. **/
	private resolve_alias(alias_name: string): string {
		const visited = new Set<string>();
		let resolved = alias_name;
		while (this._aliases.has(resolved) && !visited.has(resolved)) {
			visited.add(resolved);
			const target = this._aliases.get(resolved);
			if (target === undefined) {
				break;
			}
			resolved = target;
		}
		return resolved;
	}

	/** Responsibilities: _type source lookup_. **/
	private source_for(
		type_name: string,
		file: string,
		sources: ReadonlyMap<string, SharedParameterTypeSource>,
	): SharedParameterTypeSource {
		const local = sources.get(JSON.stringify([file, type_name]));
		if (local !== undefined && local.file.length > 0) {
			return local;
		}
		const global = sources.get(type_name);
		if (global !== undefined && global.file.length > 0) {
			return global;
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _type identity state_. **/
	public constructor(segments: readonly TypeSyntaxSegment[], aliases: ReadonlyMap<string, string>) {
		this._aliases = new Map(aliases);
		this._segments = segments;
	}

	/** Responsibilities: _canonical type syntax_. **/
	public canonical(): string {
		const normalized: string[] = [];
		for (const segment of this._segments) {
			if (segment.kind === SHARED_PARAMETER_REFERENCE_KIND) {
				normalized.push(this.resolve_alias(segment.value));
				continue;
			}
			normalized.push(segment.value);
		}
		return normalized.join("");
	}

	/** Responsibilities: _type reference names_. **/
	public reference_names(): string[] {
		const names: string[] = [];
		for (const segment of this._segments) {
			if (segment.kind !== SHARED_PARAMETER_REFERENCE_KIND) {
				continue;
			}
			names.push(this.resolve_alias(segment.value));
		}
		return names;
	}

	/** Responsibilities: _parameter source-scoped identity_. **/
	public scoped_key(
		kind: SharedParameterKind,
		parameter_name: string,
		file: string,
		sources: ReadonlyMap<string, SharedParameterTypeSource>,
	): string {
		const segments = this._segments.map((segment) => {
			if (segment.kind !== SHARED_PARAMETER_REFERENCE_KIND) {
				return segment.value;
			}
			const reference = this.resolve_alias(segment.value);
			const source = this.source_for(reference, file, sources);
			if (source.file.length === 0) {
				return reference;
			}
			return JSON.stringify([source.file, source.name]);
		});
		return JSON.stringify([kind, parameter_name, segments.join("")]);
	}
}
