import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { BoundaryFailureCategory, type SystemFailureClassificationContract } from "src/analysis_protocols";
import type {
	CachePublicationAttempt,
	CallableCacheCleanupFailureHandler,
	GlobalAnalysisCacheCleanupRequest,
	GlobalAnalysisCacheWriterIdentity,
} from "src/core/cache/types";
import type { FileEntry, IOContract } from "src/io/protocols";

/** Responsibilities: _global cache cleanup_, _temporary file ownership_, _cache record publication_. **/
export class GlobalCacheLifecycle {
	private readonly _cache_directory: string;
	private readonly _file_io: IOContract;
	private readonly _failure_classification: SystemFailureClassificationContract;
	private readonly _temporary_write_paths: Set<string>;
	private readonly _preserve_publication_failure: boolean;

	/** Responsibilities: _temporary writer identity_. **/
	private writer_identity(entry_name: string): GlobalAnalysisCacheWriterIdentity {
		const match = /\.json\.(\d+)(?:\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?\.tmp$/u.exec(
			entry_name,
		);
		if (match === null) {
			return { recognized: false, process_id: 0 };
		}
		const process_id = Number(match[1]);
		if (!Number.isSafeInteger(process_id) || process_id < 1) {
			return { recognized: false, process_id: 0 };
		}
		return { recognized: true, process_id };
	}

	/** Responsibilities: _active cache writer detection_. **/
	private writer_is_active(path: string, process_id: number): boolean {
		if (process_id === process.pid) {
			return this._temporary_write_paths.has(path);
		}
		try {
			process.kill(process_id, 0);
			return true;
		} catch (error) {
			if (!this._failure_classification.check(String(error), BoundaryFailureCategory.MissingProcess)) {
				throw error;
			}
			return false;
		}
	}

	/** Responsibilities: _cache entry inventory_. **/
	private cache_entries(): readonly FileEntry[] {
		try {
			return this._file_io.list_entries(this._cache_directory);
		} catch (error) {
			if (!this._failure_classification.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
			return [];
		}
	}

	/** Responsibilities: _abandoned cache writer cleanup_. **/
	private clean_inactive_writer(entry_path: string): void {
		this._temporary_write_paths.delete(entry_path);
		try {
			this._file_io.file(entry_path).remove_file();
		} catch (error) {
			const message = String(error);
			if (!this._failure_classification.check(message, BoundaryFailureCategory.System)) {
				throw error;
			}
			if (!message.includes("ENOENT")) {
				throw error;
			}
		}
	}

	/** Responsibilities: _committed cache record removal_. **/
	private remove_committed_record(entry_path: string): void {
		try {
			this._file_io.file(entry_path).remove_file();
		} catch (error) {
			const message = String(error);
			if (!this._failure_classification.check(message, BoundaryFailureCategory.System)) {
				throw error;
			}
			if (!message.startsWith("Error: ENOENT:")) {
				throw error;
			}
		}
	}

	/** Responsibilities: _cache entry cleanup_. **/
	private clean_entry(entry: FileEntry, request: GlobalAnalysisCacheCleanupRequest): void {
		if (!entry.is_file) {
			return;
		}
		const entry_path = join(this._cache_directory, entry.name);
		const writer = this.writer_identity(entry.name);
		if (writer.recognized) {
			if (!this.writer_is_active(entry_path, writer.process_id)) {
				this.clean_inactive_writer(entry_path);
			}
			return;
		}
		if (request.remove_records && entry.name.endsWith(".json") && entry_path !== request.current_record) {
			this.remove_committed_record(entry_path);
		}
	}

	/** Responsibilities: _temporary file cleanup_. **/
	private cleanup_failed_publication(
		attempt: CachePublicationAttempt,
		handle_failure: CallableCacheCleanupFailureHandler,
	): void {
		const file = this._file_io.file(attempt.temporary_path);
		try {
			if (!file.path_exists()) {
				return;
			}
			file.remove_file();
		} catch (error) {
			if (!this._failure_classification.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
			handle_failure(String(error));
		}
	}

	/** Responsibilities: _atomic cache record publication_. **/
	private publish_record(attempt: CachePublicationAttempt): void {
		const temporary_file = this._file_io.file(attempt.temporary_path);
		const destination_file = this._file_io.file(attempt.record_path);
		try {
			temporary_file.write_text(attempt.contents);
			temporary_file.move_to(destination_file);
		} catch (publication_error) {
			this.cleanup_failed_publication(attempt, (cleanup_failure) => {
				if (this._preserve_publication_failure) {
					throw publication_error;
				}
				throw new AggregateError(
					[publication_error, new Error(cleanup_failure)],
					"Cache publication and cleanup both failed.",
				);
			});
			if (!this._failure_classification.check(String(publication_error), BoundaryFailureCategory.System)) {
				throw publication_error;
			}
		}
	}

	/** Responsibilities: _publication readiness_. **/
	private prepare_publication(record_path: string): boolean {
		try {
			this._file_io.create_directory(this._cache_directory);
		} catch (error) {
			if (!this._failure_classification.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
			return false;
		}
		this.clean({ current_record: record_path, remove_records: false });
		return true;
	}

	/** Responsibilities: _cache lifecycle state_. **/
	public constructor(
		cache_directory: string,
		file_io: IOContract,
		failure_classification: SystemFailureClassificationContract,
		temporary_write_paths: Set<string>,
		preserve_publication_failure = false,
	) {
		this._cache_directory = cache_directory;
		this._file_io = file_io;
		this._failure_classification = failure_classification;
		this._temporary_write_paths = temporary_write_paths;
		this._preserve_publication_failure = preserve_publication_failure;
	}

	/** Responsibilities: _global cache record cleanup_. **/
	public clean(request: GlobalAnalysisCacheCleanupRequest): void {
		for (const entry of this.cache_entries()) {
			this.clean_entry(entry, request);
		}
	}

	/** Responsibilities: _atomic cache record publication_. **/
	public publish(record_path: string, contents: string): void {
		if (!this.prepare_publication(record_path)) {
			return;
		}
		const temporary_path = `${record_path}.${process.pid}.${randomUUID()}.tmp`;
		this._temporary_write_paths.add(temporary_path);
		try {
			this.publish_record({ temporary_path, record_path, contents });
		} finally {
			this._temporary_write_paths.delete(temporary_path);
		}
	}
}
