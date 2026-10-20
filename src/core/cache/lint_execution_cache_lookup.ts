import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { CacheDirectoryTree } from "src/core/cache/cache_directory_tree";
import { LintExecutionCacheRecordSnapshot } from "src/core/cache/lint_execution_cache_record_snapshot";
import {
	CACHE_DIRECTORY,
	CACHE_DIRECTORY_ENTRY_KIND,
	LINT_EXECUTION_CACHE_DIRECTORY,
	LINT_EXECUTION_CACHE_FILE,
	LINT_EXECUTION_CACHE_VERSION,
} from "src/core/constants";
import { AI_CODE_GUARD_DIRECTORY } from "src/constants";
import type { LintInputFiles } from "src/project_analysis_types";
import type { CliOptions } from "src/task_types";
import type {
	CacheState,
	LintDirectoryFingerprint,
	LintExecutionCacheRecord,
	LintFileFingerprint,
} from "src/project_analysis_types";
import type { IOContract } from "src/io/protocols";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";

/** Responsibilities: _complete-cache lookup_, _input reuse validation_. **/
export class LintExecutionCacheLookup {
	private readonly root: string;
	private readonly directory_tree: CacheDirectoryTree;
	private readonly file_io: IOContract;
	private readonly boundary_failures: BoundaryFailureClassifier;

	/** Responsibilities: _cache record validation_. **/
	private parse_record(text: string): CacheState<LintExecutionCacheRecord> {
		const record: LintExecutionCacheRecord = JSON.parse(text);
		const snapshot = new LintExecutionCacheRecordSnapshot(record);
		if (!snapshot.valid()) {
			return { available: false, value: this.empty_record() };
		}
		return { available: true, value: record };
	}

	/** Responsibilities: _cache record loading_. **/
	private load_record(): CacheState<LintExecutionCacheRecord> {
		try {
			const text = this.file_io.file_content.file_text(
				join(
					this.root,
					AI_CODE_GUARD_DIRECTORY,
					CACHE_DIRECTORY,
					LINT_EXECUTION_CACHE_DIRECTORY,
					LINT_EXECUTION_CACHE_FILE,
				),
			);
			return this.parse_record(text);
		} catch (error) {
			if (!this.boundary_failures.cache_read_failure(String(error))) {
				throw error;
			}
			return { available: false, value: this.empty_record() };
		}
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

	/** Responsibilities: _directory fingerprint validation_. **/
	private directory_names_current(directories: readonly LintDirectoryFingerprint[]): boolean {
		const expected_paths = new Set(directories.map((item) => resolve(item.directory)));
		for (const directory of this.directory_tree.directory_names(this.root)) {
			if (!expected_paths.has(directory)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _directory entry fingerprint_. **/
	private directory_entries(directory: string): string[] {
		return this.file_io.directory_entries
			.list_entries(directory)
			.map((entry) => {
				let kind = "other";
				if (entry.is_directory) {
					kind = CACHE_DIRECTORY_ENTRY_KIND;
				} else if (entry.is_file) {
					kind = "file";
				}
				return `${entry.name}\u0000${kind}`;
			})
			.sort();
	}

	/** Responsibilities: _directory fingerprint comparison_. **/
	private directory_current(expected: LintDirectoryFingerprint): boolean {
		try {
			return JSON.stringify(this.directory_entries(expected.directory)) === JSON.stringify(expected.entries);
		} catch (error) {
			if (!this.boundary_failures.system_failure_message(String(error))) {
				throw error;
			}
			return false;
		}
	}

	/** Responsibilities: _directory fingerprint validation_. **/
	private directories_current(directories: readonly LintDirectoryFingerprint[]): boolean {
		if (!this.directory_names_current(directories)) {
			return false;
		}
		return directories.every((directory) => this.directory_current(directory));
	}

	/** Responsibilities: _cache selection comparison_. **/
	private selection_matches(
		record: LintExecutionCacheRecord,
		ignored_directories: readonly string[],
		entry_files: readonly string[],
	): boolean {
		if (JSON.stringify(record.ignored_directories) !== JSON.stringify(ignored_directories)) {
			return false;
		}
		return JSON.stringify(record.entry_files) === JSON.stringify(entry_files);
	}

	/** Responsibilities: _ignore-file fingerprint reading_. **/
	private ignore_file_fingerprint(file: string): CacheState<LintFileFingerprint> {
		try {
			const current = this.file_io.file_paths.metadata(file);
			const content_hash = createHash("sha256").update(this.file_io.file_content.file_text(file)).digest("hex");
			return {
				available: true,
				value: {
					file,
					size: current.size,
					mtime_ms: current.mtime_ms,
					ctime_ms: current.ctime_ms,
					content_hash,
				},
			};
		} catch (error) {
			if (!this.boundary_failures.system_failure_message(String(error))) {
				throw error;
			}
			return {
				available: false,
				value: { file, size: -1, mtime_ms: -1, ctime_ms: -1, content_hash: "" },
			};
		}
	}

	/** Responsibilities: _ignore-file fingerprint comparison_. **/
	private ignore_file_matches(file: string, previous: LintFileFingerprint): boolean {
		const state = this.ignore_file_fingerprint(file);
		if (!state.available) {
			return false;
		}
		const current = state.value;
		if (current.size !== previous.size) {
			return false;
		}
		if (current.mtime_ms !== previous.mtime_ms || current.ctime_ms !== previous.ctime_ms) {
			return false;
		}
		return current.content_hash === previous.content_hash;
	}

	/** Responsibilities: _ignore-file content invalidation_. **/
	private ignore_files_current(record: LintExecutionCacheRecord): boolean {
		const fingerprints = new Map(record.fingerprints.map((item) => [item.file, item]));
		for (const file of record.inputs.ignore_files) {
			const previous = fingerprints.get(file);
			if (previous === undefined) {
				return false;
			}
			if (!this.ignore_file_matches(file, previous)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _cache reuse eligibility_. **/
	private record_matches(
		record: LintExecutionCacheRecord,
		ignored_directories: readonly string[],
		entry_files: readonly string[],
	): boolean {
		if (record.cache_version !== LINT_EXECUTION_CACHE_VERSION) {
			return false;
		}
		if (record.target_request !== "") {
			return false;
		}
		if (!this.selection_matches(record, ignored_directories, entry_files)) {
			return false;
		}
		if (!this.ignore_files_current(record)) {
			return false;
		}
		return this.directories_current(record.directories);
	}

	/** Responsibilities: _cache lookup initialization_. **/
	public constructor(root: string, file_io: IOContract) {
		this.directory_tree = new CacheDirectoryTree(file_io);
		this.root = resolve(root);
		this.file_io = file_io;
		this.boundary_failures = new BoundaryFailureClassifier();
	}

	/** Responsibilities: _previous cache record access_. **/
	public get previous_record(): CacheState<LintExecutionCacheRecord> {
		return this.load_record();
	}

	/** Responsibilities: _reusable input selection_. **/
	public reusable_inputs(ignored_directories: readonly string[], options: CliOptions): CacheState<LintInputFiles> {
		const state = this.previous_record;
		const empty = { files: [], project_files: [], ignored_files: [], markdown_files: [], ignore_files: [] };
		if (!options.skip_review) {
			return { available: false, value: empty };
		}
		if (!state.available) {
			return { available: false, value: empty };
		}
		const record = state.value;
		if (!this.record_matches(record, ignored_directories, options.entry_files)) {
			return { available: false, value: empty };
		}
		return { available: true, value: record.inputs };
	}
}
