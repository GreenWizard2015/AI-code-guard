import { join, resolve } from "node:path";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import { AI_CODE_GUARD_DIRECTORY } from "src/constants";
import { CacheDirectoryTree } from "src/core/cache/cache_directory_tree";
import { LintCacheInputFile } from "src/core/cache/lint_cache_input_file";
import { LintExecutionCacheRecordSnapshot } from "src/core/cache/lint_execution_cache_record_snapshot";
import {
	CACHE_DIRECTORY,
	LINT_EXECUTION_CACHE_DIRECTORY,
	LINT_EXECUTION_CACHE_FILE,
	LINT_EXECUTION_CACHE_VERSION,
} from "src/core/constants";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import type { IOContract } from "src/io/protocols";
import type { LintInputFiles } from "src/project_analysis_types";
import type { CacheState, LintExecutionCacheRecord } from "src/project_analysis_types";
import type { CliOptions } from "src/task_types";

/** Responsibilities: _complete-cache lookup_, _input reuse validation_. **/
export class LintExecutionCacheLookup {
	private readonly _root: string;
	private readonly _file_io: IOContract;
	private readonly _boundary_failures: SystemFailureClassificationContract;
	private readonly _directory_tree: CacheDirectoryTree;

	/** Responsibilities: _cache record validation_. **/
	private parse_record(text: string): CacheState<LintExecutionCacheRecord> {
		const record: LintExecutionCacheRecord = JSON.parse(text);
		const snapshot = new LintExecutionCacheRecordSnapshot(record);
		if (!snapshot.valid()) {
			return { available: false, value: this.empty_record() };
		}
		return { available: true, value: record };
	}

	/** Responsibilities: _empty cache record construction_. **/
	private empty_record(): LintExecutionCacheRecord {
		return {
			cache_version: -1,
			identity: "",
			target_request: "",
			entry_files: [],
			files: [],
			violations: [],
			fingerprints: [],
			inputs: { files: [], project_files: [], ignored_files: [], markdown_files: [], ignore_files: [] },
			ignored_directories: [],
			directories: [],
		};
	}

	/** Responsibilities: _cache selection comparison_. **/
	private selection_matches(selection_record: LintExecutionCacheRecord, request_options: CliOptions): boolean {
		if (JSON.stringify(selection_record.ignored_directories) !== JSON.stringify(request_options.ignored_directories)) {
			return false;
		}
		return JSON.stringify(selection_record.entry_files) === JSON.stringify(request_options.entry_files);
	}

	/** Responsibilities: _ignore-file content invalidation_. **/
	private ignore_files_current(record: LintExecutionCacheRecord): boolean {
		const fingerprints = new Map(record.fingerprints.map((item) => [item.file, item]));
		for (const file of record.inputs.ignore_files) {
			const previous = fingerprints.get(file);
			if (previous === undefined) {
				return false;
			}
			const input_file = new LintCacheInputFile(file, this._file_io);
			if (!input_file.ignore_file_matches(previous)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _cache reuse eligibility_. **/
	private record_matches(candidate_record: LintExecutionCacheRecord, request_options: CliOptions): boolean {
		if (candidate_record.cache_version !== LINT_EXECUTION_CACHE_VERSION) {
			return false;
		}
		if (candidate_record.target_request !== "") {
			return false;
		}
		if (!this.selection_matches(candidate_record, request_options)) {
			return false;
		}
		if (!this.ignore_files_current(candidate_record)) {
			return false;
		}
		return this._directory_tree.fingerprints_match(candidate_record.directories);
	}

	/** Responsibilities: _cache lookup initialization_. **/
	public constructor(root: string, file_io: IOContract) {
		this._root = resolve(root);
		this._file_io = file_io;
		const boundary_failures = new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES);
		this._boundary_failures = boundary_failures;
		this._directory_tree = new CacheDirectoryTree(this._root, file_io);
	}

	/** Responsibilities: _previous cache record lookup_. **/
	public previous_record(): CacheState<LintExecutionCacheRecord> {
		try {
			const text = this._file_io
				.file(
					join(
						this._root,
						AI_CODE_GUARD_DIRECTORY,
						CACHE_DIRECTORY,
						LINT_EXECUTION_CACHE_DIRECTORY,
						LINT_EXECUTION_CACHE_FILE,
					),
				)
				.file_text();
			return this.parse_record(text);
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.CacheRead)) {
				throw error;
			}
			return { available: false, value: this.empty_record() };
		}
	}

	/** Responsibilities: _reusable input selection_. **/
	public reusable_inputs(options: CliOptions): CacheState<LintInputFiles> {
		const state = this.previous_record();
		const empty = { files: [], project_files: [], ignored_files: [], markdown_files: [], ignore_files: [] };
		if (!options.skip_review) {
			return { available: false, value: empty };
		}
		if (!state.available) {
			return { available: false, value: empty };
		}
		const record = state.value;
		if (!this.record_matches(record, options)) {
			return { available: false, value: empty };
		}
		return { available: true, value: record.inputs };
	}
}
