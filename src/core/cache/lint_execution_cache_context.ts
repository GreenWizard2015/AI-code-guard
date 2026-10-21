import { createHash } from "node:crypto";
import type { Hash } from "node:crypto";
import { join, resolve } from "node:path";
import type { LintExecutionCacheContract } from "src/cache_protocols";
import { AI_CODE_GUARD_DIRECTORY, MISSING_CACHE_VALUE } from "src/constants";
import { CacheDirectoryTree } from "src/core/cache/cache_directory_tree";
import { LintExecutionCache } from "src/core/cache/lint_execution_cache";
import type { LintExecutionCacheContextOptions } from "src/core/cache/types";
import {
	CACHE_DIRECTORY,
	CACHE_INPUT_STABILITY_ATTEMPTS,
	LINT_EXECUTION_CACHE_DIRECTORY,
	LINT_EXECUTION_CACHE_FILE,
	LINT_EXECUTION_CACHE_VERSION,
} from "src/core/constants";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import type { IOContract } from "src/io/protocols";
import { TypeScriptProjectResolution } from "src/module-resolution/type_script_project_resolution";
import type { LintInputFiles } from "src/project_analysis_types";
import type {
	LintDirectoryFingerprint,
	LintExecutionCacheState,
	LintFileFingerprint,
} from "src/project_analysis_types";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { CliOptions } from "src/task_types";

/** Responsibilities: _cache identity construction_, _lint execution cache access_. **/
export class LintExecutionCacheContext {
	private readonly root: string;
	private readonly inputs: LintInputFiles;
	private readonly options: CliOptions;
	private readonly directory_tree: CacheDirectoryTree;
	private readonly analysis_identity: ProjectAnalysisIdentityContract;
	private readonly source_texts: ReadonlyMap<string, string>;
	private readonly project_resolution: TypeScriptProjectResolution;
	private readonly resolution_identity: string;
	private readonly file_io: IOContract;
	private readonly boundary_failures: BoundaryFailureClassifier;

	/** Responsibilities: _file fingerprint metadata equality_. **/
	private same_metadata(left: LintFileFingerprint, right: LintFileFingerprint): boolean {
		if (left.size !== right.size || left.mtime_ms !== right.mtime_ms) {
			return false;
		}
		return left.ctime_ms === right.ctime_ms;
	}

	/** Responsibilities: _snapshot consistency attempt_. **/
	private snapshot_attempt(file: string, source_text: string, content_hash: string): LintFileFingerprint {
		try {
			const before = this.file_io.file_paths.metadata(file);
			const current_text = this.file_io.file_content.file_text(file);
			const after = this.file_io.file_paths.metadata(file);
			const unchanged_metadata = this.same_metadata(
				{ file, ...before, content_hash },
				{ file, ...after, content_hash },
			);
			const unchanged_source = current_text.replace(/\r\n?/gu, "\n") === source_text.replace(/\r\n?/gu, "\n");
			if (unchanged_metadata && unchanged_source) {
				return { file, ...after, content_hash };
			}
		} catch (error) {
			if (!this.boundary_failures.system_failure_message(String(error))) {
				throw error;
			}
		}
		return { file, size: -1, mtime_ms: -1, ctime_ms: -1, content_hash };
	}

	/** Responsibilities: _disk content consistency attempt_. **/
	private disk_attempt(file: string): LintFileFingerprint {
		try {
			const before = this.file_io.file_paths.metadata(file);
			const current_text = this.file_io.file_content.file_text(file);
			const content_hash = createHash("sha256").update(current_text.replace(/\r\n?/gu, "\n")).digest("hex");
			const after = this.file_io.file_paths.metadata(file);
			const before_fingerprint = { file, ...before, content_hash };
			const after_fingerprint = { file, ...after, content_hash };
			if (this.same_metadata(before_fingerprint, after_fingerprint)) {
				return after_fingerprint;
			}
		} catch (error) {
			if (!this.boundary_failures.system_failure_message(String(error))) {
				throw error;
			}
		}
		return { file, size: -1, mtime_ms: -1, ctime_ms: -1, content_hash: MISSING_CACHE_VALUE };
	}

	/** Responsibilities: _stable source snapshot fingerprint_. **/
	private snapshot_fingerprint(file: string, source_text: string): LintFileFingerprint {
		const content_hash = createHash("sha256").update(source_text.replace(/\r\n?/gu, "\n")).digest("hex");
		let fingerprint: LintFileFingerprint = { file, size: -1, mtime_ms: -1, ctime_ms: -1, content_hash };
		for (let attempt = 0; attempt < CACHE_INPUT_STABILITY_ATTEMPTS; attempt += 1) {
			fingerprint = this.snapshot_attempt(file, source_text, content_hash);
			if (fingerprint.size >= 0) {
				return fingerprint;
			}
		}
		return fingerprint;
	}

	/** Responsibilities: _stable disk fingerprint_. **/
	private disk_fingerprint(file: string): LintFileFingerprint {
		let fingerprint: LintFileFingerprint = {
			file,
			size: -1,
			mtime_ms: -1,
			ctime_ms: -1,
			content_hash: MISSING_CACHE_VALUE,
		};
		for (let attempt = 0; attempt < CACHE_INPUT_STABILITY_ATTEMPTS; attempt += 1) {
			fingerprint = this.disk_attempt(file);
			if (fingerprint.size >= 0) {
				return fingerprint;
			}
		}
		return fingerprint;
	}

	/** Responsibilities: _cache input file collection_. **/
	private input_files(): string[] {
		const input_files = [
			...new Set([
				...this.inputs.files,
				...this.inputs.project_files,
				...this.inputs.ignored_files,
				...this.inputs.markdown_files,
				...this.inputs.ignore_files,
			]),
		];
		input_files.sort();
		return input_files;
	}

	/** Responsibilities: _cache selection identity hashing_. **/
	private append_selection(hash: Hash, selection: readonly string[]): void {
		hash.update("[");
		const ordered_selection = [...selection];
		ordered_selection.sort();
		for (const file of ordered_selection) {
			hash.update(`${file}\u0000`);
		}
		hash.update("]");
	}

	/** Responsibilities: _cache fingerprint identity hashing_. **/
	private append_fingerprints(hash: Hash, fingerprints: readonly LintFileFingerprint[]): void {
		for (const fingerprint of fingerprints) {
			hash.update(`${fingerprint.file}\u0000${fingerprint.content_hash}\u0000`);
		}
	}

	/** Responsibilities: _cache directory identity hashing_. **/
	private append_directories(hash: Hash, directories: readonly LintDirectoryFingerprint[]): void {
		for (const directory of directories) {
			hash.update(`${directory.directory}\u0000${directory.entries.join("\u0000")}\u0000`);
		}
	}

	/** Responsibilities: _cache input identity construction_. **/
	private identity(
		fingerprints: readonly LintFileFingerprint[],
		directories: readonly LintDirectoryFingerprint[],
	): string {
		const hash = createHash("sha256");
		hash.update(
			`${LINT_EXECUTION_CACHE_VERSION}\u0000${this.analysis_identity.analyzer()}\u0000${this.resolution_identity}\u0000${resolve(this.root)}\u0000`,
		);
		hash.update(
			`${this.options.batch_size}\u0000${this.options.policy}\u0000${this.options.skip_review}\u0000${this.options.review_cleanup}\u0000`,
		);
		for (const selection of [
			this.inputs.files,
			this.inputs.project_files,
			this.inputs.ignored_files,
			this.inputs.markdown_files,
			this.inputs.ignore_files,
		]) {
			this.append_selection(hash, selection);
		}
		this.append_selection(hash, this.options.entry_files);
		this.append_fingerprints(hash, fingerprints);
		this.append_directories(hash, directories);
		return hash.digest("hex");
	}

	/** Responsibilities: _input file fingerprints_. **/
	private input_fingerprints(): LintFileFingerprint[] {
		return this.input_files().map((file) => {
			const source_text = this.source_texts.get(file);
			if (source_text !== undefined) {
				return this.snapshot_fingerprint(file, source_text);
			}
			return this.disk_fingerprint(file);
		});
	}

	/** Responsibilities: _cache builder state assignment_. **/
	public constructor(options: LintExecutionCacheContextOptions) {
		this.root = options.root;
		this.inputs = options.inputs;
		this.options = options.options;
		this.directory_tree = new CacheDirectoryTree(options.file_io);
		this.analysis_identity = options.analysis_identity;
		this.source_texts = options.source_texts;
		this.project_resolution = new TypeScriptProjectResolution(resolve(options.root), options.source_io);
		this.resolution_identity = this.project_resolution.configuration_identity();
		this.file_io = options.file_io;
		this.boundary_failures = new BoundaryFailureClassifier();
	}

	/** Responsibilities: _lint execution cache state_. **/
	public cache_state(): LintExecutionCacheState {
		this.file_io.directory_operations.create_directory(
			join(resolve(this.root), AI_CODE_GUARD_DIRECTORY, CACHE_DIRECTORY, LINT_EXECUTION_CACHE_DIRECTORY),
		);
		const fingerprints = this.input_fingerprints();
		const directories = this.directory_tree.fingerprints(this.root, this.input_files());
		return {
			cache_file: join(
				resolve(this.root),
				AI_CODE_GUARD_DIRECTORY,
				CACHE_DIRECTORY,
				LINT_EXECUTION_CACHE_DIRECTORY,
				LINT_EXECUTION_CACHE_FILE,
			),
			identity: this.identity(fingerprints, directories),
			target_request: "",
			entry_files: [...this.options.entry_files],
			fingerprints,
			inputs: this.inputs,
			root: resolve(this.root),
			ignored_directories: [...this.options.ignored_directories],
			directories,
		};
	}

	/** Responsibilities: _lint execution cache access_. **/
	public lint_cache(): LintExecutionCacheContract {
		return new LintExecutionCache(this.cache_state(), this.file_io);
	}
}
