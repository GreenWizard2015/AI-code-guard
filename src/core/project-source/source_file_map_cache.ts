import { SourceFileMap } from "src/core/project-source/source_file_map";
import type {
	SourceFileMapContract,
	SourceFileMapResolverCacheContract,
	SourceFileResolverContract,
} from "src/core/project-source/types";
import type { SourceFileResolverCache } from "src/core/project-source/types";

/** Responsibilities: _source map lookup_, _resolver cache ownership_. **/
export class SourceFileMapCache implements SourceFileMapResolverCacheContract {
	private readonly _resolvers: SourceFileResolverCache;

	/** Responsibilities: _source resolver cache state_. **/
	public constructor() {
		this._resolvers = new WeakMap();
	}

	/** Responsibilities: _resolver lookup_. **/
	public for_map(source_files: SourceFileMapContract): SourceFileResolverContract {
		const cached_resolver = this._resolvers.get(source_files);
		if (cached_resolver !== undefined) {
			return cached_resolver;
		}
		const resolver = new SourceFileMap(source_files);
		this._resolvers.set(source_files, resolver);
		return resolver;
	}

	/** Responsibilities: _resolver cache reset_. **/
	public refresh_map(source_files: SourceFileMapContract): SourceFileResolverContract {
		const resolver = new SourceFileMap(source_files);
		this._resolvers.set(source_files, resolver);
		return resolver;
	}
}
