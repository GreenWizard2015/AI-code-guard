import { dirname, resolve } from "node:path";
import { LintFileDiscovery } from "src/core/lint_file_discovery";
import { ProjectPathRelation } from "src/core/support/project_path_relation";
import { GitIgnoredPaths } from "src/git_ignored_paths";
import type {
	LintFileDiscoveryContract,
	LintInputFileSelectorContract,
	TextFileDiscoveryContract,
} from "src/protocols";
import type { ProjectSourceIOContract } from "src/protocols";
import type {
	LintInputCandidateState,
	LintInputSelection,
	LintProjectCandidates,
	LintRawInputCandidates,
} from "src/types";
import type { LintInputFiles } from "src/types";

/** Responsibilities: _complete-cache input file discovery_, _Git-ignore filtering_. **/
export class LintInputFileSelector implements LintInputFileSelectorContract {
	private readonly empty_ignored_directories: Set<string>;
	private readonly text_files: TextFileDiscoveryContract;
	private readonly source_io: ProjectSourceIOContract;

	/** Responsibilities: _ignored directory normalization_. **/
	private configured_ignored_directories(repo_root: string, configured: readonly string[]): ReadonlySet<string> {
		const paths: string[] = [];
		for (const value of configured) {
			const trimmed = value.trim();
			if (trimmed.length > 0) {
				paths.push(resolve(repo_root, trimmed).replaceAll("\\", "/"));
			}
		}
		return new Set(paths);
	}

	/** Responsibilities: _ignored path classification_. **/
	private is_ignored_file(file: string, ignored_directories: ReadonlySet<string>): boolean {
		const directories = Array.from(ignored_directories);
		return directories.some((directory) => {
			const relation = new ProjectPathRelation(directory, file);
			return relation.inside;
		});
	}

	/** Responsibilities: _repository candidate discovery_. **/
	private repository_project_candidates(
		repo_root: string,
		target_candidates: readonly string[],
		ignored_directories: ReadonlySet<string>,
		discovery: LintFileDiscoveryContract,
	): string[] {
		const has_targets = target_candidates.length !== 0;
		const has_repository_target = target_candidates.some((file) => {
			const relation = new ProjectPathRelation(repo_root, file);
			return relation.inside;
		});
		const external_only = has_targets && !has_repository_target;
		if (external_only) {
			return [];
		}
		return discovery.walk_files_raw(repo_root, repo_root, ignored_directories);
	}

	/** Responsibilities: _external candidate discovery_. **/
	private external_project_candidates(
		repo_root: string,
		target_candidates: readonly string[],
		ignored_directories: ReadonlySet<string>,
		discovery: LintFileDiscoveryContract,
	): string[] {
		const candidate_directories = target_candidates.map((file) => dirname(file));
		const external_directories = candidate_directories.filter((directory) => {
			const relation = new ProjectPathRelation(repo_root, directory);
			return !relation.inside;
		});
		return external_directories.flatMap((directory) =>
			discovery.walk_files_raw(repo_root, directory, ignored_directories),
		);
	}

	/** Responsibilities: _lint file selection_. **/
	private selected_files(
		target_candidates: readonly string[],
		repository_project_candidates: readonly string[],
		visible: ReadonlySet<string>,
	): string[] {
		if (target_candidates.length === 0) {
			return repository_project_candidates.filter((file) => visible.has(file));
		}
		return target_candidates.filter((file) => visible.has(file));
	}

	/** Responsibilities: _raw project candidate collection_. **/
	private project_candidates(
		repo_root: string,
		target_candidates: readonly string[],
		ignored_directories: ReadonlySet<string>,
		discovery: LintFileDiscoveryContract,
	): LintProjectCandidates {
		return {
			repository: this.repository_project_candidates(repo_root, target_candidates, ignored_directories, discovery),
			external: this.external_project_candidates(repo_root, target_candidates, ignored_directories, discovery),
		};
	}

	/** Responsibilities: _explicit project candidate selection_. **/
	private project_candidates_for(
		repo_root: string,
		explicit_files: readonly string[],
		target_candidates: readonly string[],
		ignored_directories: ReadonlySet<string>,
		discovery: LintFileDiscoveryContract,
	): LintProjectCandidates {
		if (explicit_files.length > 0 && target_candidates.length === 0) {
			return { repository: [], external: [] };
		}
		return this.project_candidates(repo_root, target_candidates, ignored_directories, discovery);
	}

	/** Responsibilities: _raw source candidates_. **/
	private raw_file_candidates(
		repo_root: string,
		explicit_files: readonly string[],
		ignored_directories: ReadonlySet<string>,
		discovery: LintFileDiscoveryContract,
	): LintRawInputCandidates {
		const target = explicit_files
			.map((file) => resolve(repo_root, file))
			.filter((file) => !this.is_ignored_file(file, ignored_directories));
		const ignored = Array.from(ignored_directories).flatMap((directory) =>
			discovery.walk_files_raw(repo_root, directory, this.empty_ignored_directories),
		);
		return {
			target_candidates: target,
			repository_project_candidates: [],
			external_project_candidates: [],
			ignored_candidates: ignored,
			markdown_candidates: this.text_files.files_unfiltered(repo_root, ignored_directories),
		};
	}

	/** Responsibilities: _raw cache candidate collection_. **/
	private raw_candidates(
		repo_root: string,
		configured: readonly string[],
		explicit_files: readonly string[] = [],
	): LintRawInputCandidates {
		const ignored_directories = this.configured_ignored_directories(repo_root, configured);
		const discovery = new LintFileDiscovery(this.source_io);
		const source_candidates = this.raw_file_candidates(repo_root, explicit_files, ignored_directories, discovery);
		const target_candidates = source_candidates.target_candidates;
		const project_candidates = this.project_candidates_for(
			repo_root,
			explicit_files,
			target_candidates,
			ignored_directories,
			discovery,
		);
		return {
			target_candidates,
			repository_project_candidates: project_candidates.repository,
			external_project_candidates: project_candidates.external,
			ignored_candidates: source_candidates.ignored_candidates,
			markdown_candidates: source_candidates.markdown_candidates,
		};
	}

	/** Responsibilities: _visible cache candidate collection_. **/
	private candidate_state(
		repo_root: string,
		configured: readonly string[],
		explicit_files: readonly string[] = [],
	): LintInputCandidateState {
		const candidates = this.raw_candidates(repo_root, configured, explicit_files);
		const git_ignored_paths = new GitIgnoredPaths(repo_root, this.source_io);
		const visible = new Set(
			git_ignored_paths.filter([
				...candidates.target_candidates,
				...candidates.repository_project_candidates,
				...candidates.external_project_candidates,
				...candidates.ignored_candidates,
				...candidates.markdown_candidates,
			]),
		);
		return {
			...candidates,
			visible,
			ignore_files: git_ignored_paths.configuration_files(),
		};
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

	/** Responsibilities: _complete-cache selector dependencies_. **/
	public constructor(text_files: TextFileDiscoveryContract, source_io: ProjectSourceIOContract) {
		this.empty_ignored_directories = new Set<string>();
		this.text_files = text_files;
		this.source_io = source_io;
	}

	/** Responsibilities: _project file selection_. **/
	public selected_project_files(selection: LintInputSelection): string[] {
		const repository_files = selection.files.some((file) => {
			const relation = new ProjectPathRelation(selection.repo_root, file);
			return relation.inside;
		});
		if (selection.target_candidates.length === 0) {
			return selection.repository_project_candidates.filter((file) => selection.visible.has(file));
		}
		if (repository_files) {
			return selection.repository_project_candidates.filter((file) => selection.visible.has(file));
		}
		return selection.external_project_candidates.filter((file) => selection.visible.has(file));
	}

	/** Responsibilities: _complete-cache input collection_. **/
	public input_files(
		repo_root: string,
		configured: readonly string[],
		explicit_files: readonly string[] = [],
	): LintInputFiles {
		const candidates = this.candidate_state(repo_root, configured, explicit_files);
		const files = this.selected_files(
			candidates.target_candidates,
			candidates.repository_project_candidates,
			candidates.visible,
		);
		const selected_project_files = this.selected_project_files({
			repo_root,
			target_candidates: candidates.target_candidates,
			files,
			repository_project_candidates: candidates.repository_project_candidates,
			external_project_candidates: candidates.external_project_candidates,
			visible: candidates.visible,
		});
		const ignored_files = candidates.ignored_candidates.filter((file) => candidates.visible.has(file));
		const project_files = this.production_project_files(selected_project_files, ignored_files);
		const markdown_files = candidates.markdown_candidates.filter((file) => candidates.visible.has(file));
		return { files, project_files, ignored_files, markdown_files, ignore_files: candidates.ignore_files };
	}
}
