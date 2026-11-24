import type {
	CallableMethodFiles,
	CallableUsageFile,
	MethodFileIndexSnapshot,
} from "src/contracts/types/callable_usage_types";
import type { ParsedFile } from "src/metrics/types";
import type { SourceReference } from "src/source_types";

/** Responsibilities: _method candidate files_, _candidate cache_. **/
export class MethodFileIndex {
	private readonly _by_owner_set: Map<string, CallableMethodFiles>;

	/** Responsibilities: _owner file resolution_. **/
	private append_owner_files(
		candidates: Map<string, ParsedFile>,
		references: readonly SourceReference[],
		files_by_name: ReadonlyMap<string, CallableUsageFile>,
	): void {
		for (const reference of references) {
			const file = files_by_name.get(reference.file);
			if (file !== undefined) {
				candidates.set(file.file, file);
			}
		}
	}

	/** Responsibilities: _protocol method candidate files_. **/
	private append_protocol_files(
		candidates: Map<string, ParsedFile>,
		owners: ReadonlyMap<string, readonly SourceReference[]>,
		protocol_names: ReadonlySet<string>,
		files_by_name: ReadonlyMap<string, CallableUsageFile>,
	): void {
		for (const [owner, references] of owners) {
			if (protocol_names.has(owner)) {
				this.append_owner_files(candidates, references, files_by_name);
			}
		}
	}

	/** Responsibilities: _protocol owner file collection_. **/
	private build(snapshot: MethodFileIndexSnapshot): CallableMethodFiles {
		const files_by_method = new Map<string, readonly ParsedFile[]>();
		for (const [method_name, owners] of snapshot.method_references) {
			const candidates = new Map<string, ParsedFile>();
			this.append_protocol_files(candidates, owners, snapshot.protocol_names, snapshot.files_by_name);
			files_by_method.set(method_name, Object.freeze([...candidates.values()]));
		}
		return files_by_method;
	}

	/** Responsibilities: _method file index initialization_. **/
	public constructor() {
		this._by_owner_set = new Map();
	}

	/** Responsibilities: _protocol method file lookup_. **/
	public candidates(snapshot: MethodFileIndexSnapshot): CallableMethodFiles {
		const names = [...snapshot.protocol_names];
		names.sort();
		const key = JSON.stringify(names);
		const cached = this._by_owner_set.get(key);
		if (cached !== undefined) {
			return cached;
		}
		const files = this.build(snapshot);
		this._by_owner_set.set(key, files);
		return files;
	}

	/** Responsibilities: _protocol cache invalidation_. **/
	public clear(): void {
		this._by_owner_set.clear();
	}
}
