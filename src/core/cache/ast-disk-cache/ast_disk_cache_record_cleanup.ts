import { resolve } from "node:path";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import { AstCacheMiss } from "src/core/cache/ast-disk-cache/ast_cache_miss";
import { AstCacheRecordState } from "src/core/cache/ast-disk-cache/ast_cache_record_state";
import type { AstCacheSourceIdentity } from "src/core/cache/ast-disk-cache/types";
import type { IOContract } from "src/io/protocols";
import type { AstCacheRecord } from "src/model_types";
import type { AstCacheEntryContract } from "src/source_protocols";

/** Responsibilities: _cache record validation_, _cache entry retention_. **/
export class AstDiskCacheRecordCleanup {
	private readonly _cache_directory: string;
	private readonly _project_identity: string;
	private readonly _file_io: IOContract;
	private readonly _failure_classification: SystemFailureClassificationContract;
	private readonly _cleaned_entries: Map<string, AstCacheEntryContract>;
	private readonly _unavailable_reason: string = "cache file unavailable";

	/** Responsibilities: _cache record validation_. **/
	private validated_record(file: string): AstCacheEntryContract {
		try {
			const record: AstCacheRecord = JSON.parse(this._file_io.file(file).file_text());
			const state = new AstCacheRecordState(this._cache_directory, file, this._project_identity, record);
			return state.validated_entry(this._file_io);
		} catch (error) {
			if (!this._failure_classification.check(String(error), BoundaryFailureCategory.CacheRead)) {
				throw error;
			}
			return new AstCacheMiss(file, this._unavailable_reason);
		}
	}

	/** Responsibilities: _record cleanup state_. **/
	public constructor(
		cache_directory: string,
		project_identity: string,
		file_io: IOContract,
		failure_classification: SystemFailureClassificationContract,
		cleaned_entries: Map<string, AstCacheEntryContract>,
	) {
		this._cache_directory = cache_directory;
		this._project_identity = project_identity;
		this._file_io = file_io;
		this._failure_classification = failure_classification;
		this._cleaned_entries = cleaned_entries;
	}

	/** Responsibilities: _cache record pruning_. **/
	public remove_unused_record(file: string): void {
		const entry = this.validated_record(file);
		if (!entry.present()) {
			try {
				this._file_io.file(file).remove_file();
			} catch (error) {
				if (!this._failure_classification.check(String(error), BoundaryFailureCategory.System)) {
					throw error;
				}
			}
			return;
		}
		this._cleaned_entries.set(resolve(file), entry);
	}

	/** Responsibilities: _cache record lookup_. **/
	public cache_entry(path: string, source_file: string, source_hash: string): AstCacheEntryContract {
		try {
			const record: AstCacheRecord = JSON.parse(this._file_io.file(path).file_text());
			const state = new AstCacheRecordState(this._cache_directory, path, this._project_identity, record);
			const identity: AstCacheSourceIdentity = { source_file, source_hash };
			return state.entry(identity);
		} catch (error) {
			if (!this._failure_classification.check(String(error), BoundaryFailureCategory.CacheRead)) {
				throw error;
			}
			return new AstCacheMiss(source_file, this._unavailable_reason);
		}
	}
}
