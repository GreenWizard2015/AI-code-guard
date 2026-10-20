import { dirname, join } from "node:path";
import { LintExecutionCacheRecordSnapshot } from "src/core/cache/lint_execution_cache_record_snapshot";
import { LINT_EXECUTION_CACHE_VERSION } from "src/core/constants";
import type { LintExecutionCacheContract, LintExecutionCacheRecordSnapshotContract } from "src/cache_protocols";
import type { LintInputFiles, LintRunResult } from "src/project_analysis_types";
import type {
	CacheState,
	LintDirectoryFingerprint,
	LintExecutionCacheRecord,
	LintExecutionCacheState,
	LintFileFingerprint,
} from "src/project_analysis_types";
import { ViolationValue } from "src/violation_value";
import type { IOContract } from "src/io/protocols";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";

/** Responsibilities: _complete lint result reuse_, _content invalidation_. **/
export class LintExecutionCache implements LintExecutionCacheContract {
	private readonly cache_file: string;
	private readonly identity: string;
	private readonly target_request: string;
	private readonly entry_files: string[];
	private readonly fingerprints: LintFileFingerprint[];
	private readonly inputs: LintInputFiles;
	private readonly ignored_directories: string[];
	private readonly directories_snapshot: LintDirectoryFingerprint[];
	private readonly file_io: IOContract;
	private readonly boundary_failures: BoundaryFailureClassifier;

	/** Responsibilities: _cache record construction_. **/
	private cache_record(result: LintRunResult): LintExecutionCacheRecord {
		return {
			cache_version: LINT_EXECUTION_CACHE_VERSION,
			identity: this.identity,
			target_request: this.target_request,
			entry_files: this.entry_files,
			files: result.files,
			violations: result.violations.map((violation) => violation.details()),
			fingerprints: this.fingerprints,
			inputs: this.inputs,
			ignored_directories: this.ignored_directories,
			directories: this.directories_snapshot,
		};
	}

	/** Responsibilities: _stale cache file cleanup_. **/
	private remove_stale_records(directory: string): void {
		for (const entry of this.file_io.directory_entries.list_files(directory)) {
			if (entry.startsWith("lint-result-") && entry.endsWith(".json")) {
				this.file_io.file_operations.remove_file(join(directory, entry));
			}
		}
	}

	/** Responsibilities: _atomic cache record persistence_. **/
	private persist_record(record: LintExecutionCacheRecord): void {
		const temporary = `${this.cache_file}.${process.pid}.tmp`;
		this.file_io.file_content.write_text(temporary, JSON.stringify(record));
		this.file_io.file_operations.move_file(temporary, this.cache_file);
	}

	/** Responsibilities: _cached result validity_. **/
	private cache_record_valid(
		record: LintExecutionCacheRecord,
		snapshot: LintExecutionCacheRecordSnapshotContract,
	): boolean {
		if (!snapshot.valid()) {
			return false;
		}
		if (record.cache_version !== LINT_EXECUTION_CACHE_VERSION) {
			return false;
		}
		return snapshot.identity_matches(this.identity);
	}

	/** Responsibilities: _cached result conversion_. **/
	private cache_result(record: LintExecutionCacheRecord): LintRunResult {
		return {
			files: record.files,
			violations: record.violations.map((violation) => new ViolationValue(violation)),
		};
	}

	/** Responsibilities: _cache state assignment_. **/
	public constructor(state: LintExecutionCacheState, file_io: IOContract) {
		this.cache_file = state.cache_file;
		this.identity = state.identity;
		this.target_request = state.target_request;
		this.entry_files = state.entry_files;
		this.fingerprints = state.fingerprints;
		this.inputs = state.inputs;
		this.ignored_directories = state.ignored_directories;
		this.directories_snapshot = state.directories;
		this.file_io = file_io;
		this.boundary_failures = new BoundaryFailureClassifier();
	}

	/** Responsibilities: _cached complete result retrieval_. **/
	public cached_result(): CacheState<LintRunResult> {
		try {
			const record: LintExecutionCacheRecord = JSON.parse(this.file_io.file_content.file_text(this.cache_file));
			const snapshot = new LintExecutionCacheRecordSnapshot(record);
			if (!this.cache_record_valid(record, snapshot)) {
				return { available: false, value: { files: [], violations: [] } };
			}
			return { available: true, value: this.cache_result(record) };
		} catch (error) {
			if (!this.boundary_failures.cache_read_failure(String(error))) {
				throw error;
			}
			return { available: false, value: { files: [], violations: [] } };
		}
	}

	/** Responsibilities: _cached complete result persistence_. **/
	public write(result: LintRunResult): void {
		try {
			const directory = dirname(this.cache_file);
			this.file_io.directory_operations.create_directory(directory);
			this.remove_stale_records(directory);
			this.persist_record(this.cache_record(result));
		} catch (error) {
			if (!this.boundary_failures.system_failure_message(String(error))) {
				throw error;
			}
		}
	}
}
