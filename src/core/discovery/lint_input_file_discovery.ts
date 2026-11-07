import { dirname, resolve } from "node:path";
import type { LintFileDiscoveryContract } from "src/analysis_protocols";
import { IGNORED_DIRS } from "src/constants";
import { LintFileDiscovery } from "src/core/discovery/lint_file_discovery";
import { ProjectPathRelation } from "src/core/support/project_path_relation";
import { GitIgnoredPaths } from "src/git_ignored_paths";
import type {
	LintInputCandidateState,
	LintInputSelection,
	LintInputVisibility,
	LintProjectCandidates,
	LintRawInputCandidates,
} from "src/project_analysis_types";
import type { LintInputFiles } from "src/project_analysis_types";
import type { TextFileDiscoveryContract } from "src/runtime_protocols";
import type { LintInputFileDiscoveryOptions } from "src/source_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _request-scoped source candidates_, _visible project file selection_. **/
export class LintInputFileDiscovery {
	private readonly _empty_ignored_directories: Set<string>;
	private readonly _repo_root: string;
	private readonly _ignored_directories: ReadonlySet<string>;
	private readonly _discovery: LintFileDiscoveryContract;
	private readonly _ignored_discovery: LintFileDiscoveryContract;
	private readonly _text_files: TextFileDiscoveryContract;
	private readonly _source_io: ProjectSourceIOContract;
	private readonly _git_ignored_paths: GitIgnoredPaths;
	private readonly _target_candidates: string[];

	/** Responsibilities: _ignored path classification_. **/
	private is_ignored_file(file: string): boolean {
		for (const directory of this._ignored_directories) {
			const relation = new ProjectPathRelation(directory, file);
			if (relation.inside_root()) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _repository candidate discovery_. **/
	/** Responsibilities: _external candidate discovery_. **/
	private external_project_candidates(): string[] {
		const candidate_directories = this._target_candidates.map((file) => dirname(file));
		const external_directories = candidate_directories.filter((directory) => {
			const relation = new ProjectPathRelation(this._repo_root, directory);
			return !relation.inside_root();
		});
		return external_directories.flatMap((directory) =>
			this._discovery.walk_files_from(this._source_io.source_paths(directory, IGNORED_DIRS)),
		);
	}

	/** Responsibilities: _project candidate collection_. **/
	private project_candidates(paths: readonly string[]): LintProjectCandidates {
		const has_targets = this._target_candidates.length > 0;
		const has_repository_target = this._target_candidates.some((file) => {
			const relation = new ProjectPathRelation(this._repo_root, file);
			return relation.inside_root();
		});
		let repository: string[] = [];
		if (!has_targets || has_repository_target) {
			repository = this._discovery.walk_files_from(paths);
		}
		return {
			repository,
			external: this.external_project_candidates(),
		};
	}

	/** Responsibilities: _raw source candidates_. **/
	private raw_file_candidates(paths: readonly string[]): LintRawInputCandidates {
		const ignored = this._ignored_discovery.walk_files_from(paths).filter((file) => this.is_ignored_file(file));
		return {
			target_candidates: this._target_candidates,
			repository_project_candidates: [],
			external_project_candidates: [],
			ignored_candidates: ignored,
			markdown_candidates: this._text_files
				.for_project(this._repo_root, this._ignored_directories)
				.files_unfiltered_from(paths),
		};
	}

	/** Responsibilities: _project file selection_. **/
	private selected_project_files(selection: LintInputSelection): string[] {
		const repository_files = selection.files.some((file) => {
			const relation = new ProjectPathRelation(selection.repo_root, file);
			return relation.inside_root();
		});
		if (selection.target_candidates.length === 0 || repository_files) {
			return selection.repository_project_candidates.filter((file) => selection.visible.has(file));
		}
		return selection.external_project_candidates.filter((file) => selection.visible.has(file));
	}

	/** Responsibilities: _production source graph assembly_. **/
	private production_project_files(selected: readonly string[], ignored: readonly string[]): string[] {
		const files = new Set(selected);
		for (const file of ignored) {
			files.add(file);
		}
		const ordered_files = Array.from(files);
		return ordered_files.sort();
	}

	/** Responsibilities: _source file selection_. **/
	private selected_files(
		target_candidates: readonly string[],
		repository_candidates: readonly string[],
		visible: ReadonlySet<string>,
	): string[] {
		let candidates = repository_candidates;
		if (target_candidates.length > 0) {
			candidates = target_candidates;
		}
		return Array.from(new Set(candidates.filter((file) => visible.has(file))));
	}

	/** Responsibilities: _project graph assembly_. **/
	private project_files(selection: LintInputSelection, ignored_candidates: readonly string[]): string[] {
		const selected = this.selected_project_files(selection);
		const ignored = ignored_candidates.filter((file) => selection.visible.has(file));
		return this.production_project_files(selected, ignored);
	}

	/** Responsibilities: _candidate visibility resolution_. **/
	private candidate_visibility(candidates: LintRawInputCandidates): LintInputVisibility {
		const visible = new Set(
			this._git_ignored_paths.filter([
				...candidates.target_candidates,
				...candidates.repository_project_candidates,
				...candidates.external_project_candidates,
				...candidates.ignored_candidates,
				...candidates.markdown_candidates,
			]),
		);
		return { visible, ignore_files: this._git_ignored_paths.configuration_files() };
	}

	/** Responsibilities: _request-scoped file discovery initialization_. **/
	public constructor(options: LintInputFileDiscoveryOptions) {
		this._empty_ignored_directories = new Set<string>();
		this._repo_root = options.repo_root;
		this._ignored_directories = options.ignored_directories;
		this._git_ignored_paths = new GitIgnoredPaths(this._repo_root, options.source_io);
		this._discovery = new LintFileDiscovery(
			this._repo_root,
			this._ignored_directories,
			options.source_io,
			this._git_ignored_paths,
		);
		this._ignored_discovery = new LintFileDiscovery(
			this._repo_root,
			this._empty_ignored_directories,
			options.source_io,
			this._git_ignored_paths,
		);
		this._text_files = options.text_files;
		this._source_io = options.source_io;
		this._target_candidates = options.explicit_files
			.map((file) => resolve(this._repo_root, file))
			.filter((file) => !this.is_ignored_file(file));
	}

	/** Responsibilities: _visible cache candidate collection_. **/
	public candidate_state(): LintInputCandidateState {
		const paths = this._source_io.source_paths(this._repo_root, IGNORED_DIRS);
		const candidates = this.raw_file_candidates(paths);
		const project_candidates = this.project_candidates(paths);
		const raw_candidates: LintRawInputCandidates = {
			...candidates,
			repository_project_candidates: project_candidates.repository,
			external_project_candidates: project_candidates.external,
		};
		const visibility = this.candidate_visibility(raw_candidates);
		return {
			...raw_candidates,
			...visibility,
		};
	}

	/** Responsibilities: _complete-cache input assembly_. **/
	public input_files(candidates: LintInputCandidateState): LintInputFiles {
		const files = this.selected_files(
			candidates.target_candidates,
			candidates.repository_project_candidates,
			candidates.visible,
		);
		const selection: LintInputSelection = {
			repo_root: this._repo_root,
			target_candidates: candidates.target_candidates,
			files,
			repository_project_candidates: candidates.repository_project_candidates,
			external_project_candidates: candidates.external_project_candidates,
			visible: candidates.visible,
		};
		const project_files = this.project_files(selection, candidates.ignored_candidates);
		return {
			files,
			project_files,
			ignored_files: candidates.ignored_candidates.filter((file) => candidates.visible.has(file)),
			markdown_files: candidates.markdown_candidates.filter((file) => candidates.visible.has(file)),
			ignore_files: candidates.ignore_files,
		};
	}
}
