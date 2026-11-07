import { dirname } from "node:path";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import type { LintExecutionCacheContract, LintExecutionCacheRecordSnapshotContract } from "src/cache_protocols";
import { GlobalCacheLifecycle } from "src/core/cache/global_cache_lifecycle";
import { LintExecutionCacheRecordSnapshot } from "src/core/cache/lint_execution_cache_record_snapshot";
import { LINT_EXECUTION_CACHE_VERSION } from "src/core/constants";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import type { IOContract } from "src/io/protocols";
import { ViolationValue } from "src/model/violation_value";
import type { LintInputFiles, LintRunResult } from "src/project_analysis_types";
import type {
	CacheState,
	LintDirectoryFingerprint,
	LintExecutionCacheRecord,
	LintExecutionCacheState,
	LintFileFingerprint,
} from "src/project_analysis_types";

/** Responsibilities: _complete lint result reuse_, _content invalidation_. **/
export class LintExecutionCache implements LintExecutionCacheContract {
	private readonly _cache_file: string;
	private readonly _identity: string;
	private readonly _target_request: string;
	private readonly _entry_files: string[];
	private readonly _fingerprints: LintFileFingerprint[];
	private readonly _inputs: LintInputFiles;
	private readonly _ignored_directories: string[];
	private readonly _directories_snapshot: LintDirectoryFingerprint[];
	private readonly _file_io: IOContract;
	private readonly _boundary_failures: SystemFailureClassificationContract;
	private readonly _cache_lifecycle: GlobalCacheLifecycle;

	/** Responsibilities: _cached record text access_. **/
	private cached_record_text(): CacheState<string> {
		try {
			return { available: true, value: this._file_io.file(this._cache_file).file_text() };
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.CacheRead)) {
				throw error;
			}
			return { available: false, value: "" };
		}
	}

	/** Responsibilities: _cached result decoding_. **/
	private decode_result(record_text: string): CacheState<LintRunResult> {
		let record: LintExecutionCacheRecord;
		try {
			record = JSON.parse(record_text);
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.CacheRead)) {
				throw error;
			}
			return { available: false, value: { files: [], violations: [] } };
		}
		const snapshot = new LintExecutionCacheRecordSnapshot(record);
		if (!this.cache_record_valid(record, snapshot)) {
			return { available: false, value: { files: [], violations: [] } };
		}
		return { available: true, value: this.cache_result(record) };
	}

	/** Responsibilities: _cached result validity_. **/
	private cache_record_valid(
		candidate_record: LintExecutionCacheRecord,
		snapshot: LintExecutionCacheRecordSnapshotContract,
	): boolean {
		if (!snapshot.valid()) {
			return false;
		}
		if (candidate_record.cache_version !== LINT_EXECUTION_CACHE_VERSION) {
			return false;
		}
		return snapshot.identity_matches(this._identity);
	}

	/** Responsibilities: _cached result conversion_. **/
	private cache_result(validated_record: LintExecutionCacheRecord): LintRunResult {
		return {
			files: validated_record.files,
			violations: validated_record.violations.map((violation) => new ViolationValue(violation)),
		};
	}

	/** Responsibilities: _cache state assignment_. **/
	public constructor(state: LintExecutionCacheState, file_io: IOContract, temporary_write_paths: Set<string>) {
		this._cache_file = state.cache_file;
		this._identity = state.identity;
		this._target_request = state.target_request;
		this._entry_files = state.entry_files;
		this._fingerprints = state.fingerprints;
		this._inputs = state.inputs;
		this._ignored_directories = state.ignored_directories;
		this._directories_snapshot = state.directories;
		this._file_io = file_io;
		this._boundary_failures = new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES);
		this._cache_lifecycle = new GlobalCacheLifecycle(
			dirname(this._cache_file),
			this._file_io,
			this._boundary_failures,
			temporary_write_paths,
			true,
		);
	}

	/** Responsibilities: _cached complete result retrieval_. **/
	public cached_result(): CacheState<LintRunResult> {
		this._cache_lifecycle.clean({ current_record: this._cache_file, remove_records: false });
		const cached_text = this.cached_record_text();
		if (!cached_text.available) {
			return { available: false, value: { files: [], violations: [] } };
		}
		return this.decode_result(cached_text.value);
	}

	/** Responsibilities: _cached complete result persistence_. **/
	public write(result: LintRunResult): void {
		const record: LintExecutionCacheRecord = {
			cache_version: LINT_EXECUTION_CACHE_VERSION,
			identity: this._identity,
			target_request: this._target_request,
			entry_files: this._entry_files,
			files: result.files,
			violations: result.violations.map((violation) => ({
				file: violation.file(),
				line: violation.line(),
				message: violation.message(),
				hint: violation.hint(),
				rule_id: violation.rule_id(),
				priority: violation.priority(),
			})),
			fingerprints: this._fingerprints,
			inputs: this._inputs,
			ignored_directories: this._ignored_directories,
			directories: this._directories_snapshot,
		};
		this._cache_lifecycle.publish(this._cache_file, JSON.stringify(record));
	}
}
