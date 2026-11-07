import { join, resolve } from "node:path";
import type { LintExecutionCacheContract } from "src/cache_protocols";
import { AI_CODE_GUARD_DIRECTORY, PYTHON_PROJECT_CONFIGURATION_FILE } from "src/constants";
import { CacheDirectoryTree } from "src/core/cache/cache_directory_tree";
import { LintCacheInputFile } from "src/core/cache/lint_cache_input_file";
import { LintExecutionCache } from "src/core/cache/lint_execution_cache";
import { LintExecutionCacheIdentity } from "src/core/cache/lint_execution_cache_identity";
import type { LintExecutionCacheContextOptions } from "src/core/cache/types";
import {
	CACHE_DIRECTORY,
	LINT_EXECUTION_CACHE_DIRECTORY,
	LINT_EXECUTION_CACHE_FILE,
	LINT_EXECUTION_CACHE_VERSION,
} from "src/core/constants";
import { ProjectRuntimeSourcePaths } from "src/core/project-source/project_runtime_source_paths";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import type { IOContract } from "src/io/protocols";
import { TypeScriptProjectResolution } from "src/module-resolution/project-resolution/type_script_project_resolution";
import type { LintInputFiles } from "src/project_analysis_types";
import type {
	LintDirectoryFingerprint,
	LintExecutionCacheState,
	LintFileFingerprint,
} from "src/project_analysis_types";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { CliOptions } from "src/task_types";

/** Responsibilities: _cache identity construction_, _lint execution cache access_. **/
export class LintExecutionCacheContext {
	private readonly _root: string;
	private readonly _inputs: LintInputFiles;
	private readonly _options: CliOptions;
	private readonly _directory_tree: CacheDirectoryTree;
	private readonly _analysis_identity: ProjectAnalysisIdentityContract;
	private readonly _source_texts: ReadonlyMap<string, string>;
	private readonly _source_snapshot_complete: boolean;
	private readonly _source_io: ProjectSourceIOContract;
	private readonly _runtime_source_paths: ProjectRuntimeSourcePaths;
	private readonly _project_resolution: TypeScriptProjectResolution;
	private readonly _resolution_identity: string;
	private readonly _file_io: IOContract;
	private readonly _temporary_write_paths: Set<string>;

	/** Responsibilities: _cache input file collection_. **/
	private input_files(): string[] {
		const runtime_file_set = new Set<string>();
		this._runtime_source_paths.append_to(runtime_file_set, runtime_file_set);
		let runtime_files = [...runtime_file_set];
		if (this._source_texts.size > 0) {
			runtime_files = [...this._source_texts.keys()];
		}
		const input_files = [
			...new Set([
				...this._inputs.files,
				...this._inputs.project_files,
				...this._inputs.ignored_files,
				...this._inputs.markdown_files,
				...this._inputs.ignore_files,
				...runtime_files,
				...this._project_resolution.configuration_files(),
				join(resolve(this._root), PYTHON_PROJECT_CONFIGURATION_FILE),
			]),
		];
		input_files.sort();
		return input_files;
	}

	/** Responsibilities: _cache input identity construction_. **/
	private identity(
		fingerprints: readonly LintFileFingerprint[],
		directories: readonly LintDirectoryFingerprint[],
	): string {
		const identity_header = `${LINT_EXECUTION_CACHE_VERSION}\u0000${this._analysis_identity.analyzer()}\u0000${this._resolution_identity}\u0000${resolve(this._root)}\u0000${this._options.batch_size}\u0000${this._options.policy}\u0000${this._options.skip_review}\u0000${this._options.review_cleanup}\u0000`;
		const identity = new LintExecutionCacheIdentity(identity_header);
		identity.append_selection(this._inputs.files);
		identity.append_selection(this._inputs.project_files);
		identity.append_selection(this._inputs.ignored_files);
		identity.append_selection(this._inputs.markdown_files);
		identity.append_selection(this._inputs.ignore_files);
		identity.append_selection(this._options.entry_files);
		identity.append_selection(this._options.ignored_directories);
		identity.append_fingerprints(fingerprints);
		identity.append_directories(directories);
		return identity.value();
	}

	/** Responsibilities: _input file fingerprints_. **/
	private input_fingerprints(files: readonly string[]): LintFileFingerprint[] {
		return files.map((file) => {
			const cache_input_file = new LintCacheInputFile(file, this._file_io);
			const source_text = this._source_texts.get(file);
			if (source_text !== undefined) {
				return cache_input_file.snapshot_fingerprint(source_text);
			}
			if (this._source_snapshot_complete) {
				if (this._source_io.source_available(file)) {
					return cache_input_file.snapshot_fingerprint(this._source_io.source_text(file));
				}
			}
			return cache_input_file.disk_fingerprint();
		});
	}

	/** Responsibilities: _cache builder state assignment_. **/
	public constructor(options: LintExecutionCacheContextOptions) {
		this._root = options.root;
		this._inputs = options.inputs;
		this._options = options.options;
		this._directory_tree = new CacheDirectoryTree(this._root, options.file_io);
		this._analysis_identity = options.analysis_identity;
		this._source_texts = options.source_texts;
		this._source_snapshot_complete = options.source_snapshot_complete;
		this._source_io = options.source_io;
		this._runtime_source_paths = new ProjectRuntimeSourcePaths(this._root, options.source_io);
		let resolution_source_io = options.source_io;
		if (options.source_texts.size > 0) {
			resolution_source_io = new InMemoryProjectSourceIO(options.source_texts);
		}
		this._project_resolution = new TypeScriptProjectResolution(resolve(options.root), resolution_source_io);
		this._resolution_identity = this._project_resolution.configuration_identity();
		this._file_io = options.file_io;
		this._temporary_write_paths = options.temporary_write_paths ?? new Set<string>();
	}

	/** Responsibilities: _lint execution cache state_. **/
	public cache_state(): LintExecutionCacheState {
		this._file_io.create_directory(
			join(resolve(this._root), AI_CODE_GUARD_DIRECTORY, CACHE_DIRECTORY, LINT_EXECUTION_CACHE_DIRECTORY),
		);
		const files = this.input_files();
		const fingerprints = this.input_fingerprints(files);
		const directories = this._directory_tree.fingerprints(files);
		return {
			cache_file: join(
				resolve(this._root),
				AI_CODE_GUARD_DIRECTORY,
				CACHE_DIRECTORY,
				LINT_EXECUTION_CACHE_DIRECTORY,
				LINT_EXECUTION_CACHE_FILE,
			),
			identity: this.identity(fingerprints, directories),
			target_request: "",
			entry_files: [...this._options.entry_files],
			fingerprints,
			inputs: this._inputs,
			root: resolve(this._root),
			ignored_directories: [...this._options.ignored_directories],
			directories,
		};
	}

	/** Responsibilities: _lint execution cache access_. **/
	public lint_cache(): LintExecutionCacheContract {
		return new LintExecutionCache(this.cache_state(), this._file_io, this._temporary_write_paths);
	}
}
