import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { GITIGNORE_FILE_NAME } from "src/constants";
import { ProjectPathRelation } from "src/core/support/project_path_relation";
import type { ProjectPathRelationContract } from "src/core/support/protocols";
import { GitIgnorePatternCatalog } from "src/git_ignore_pattern_catalog";
import type { GitIgnorePattern, GitIgnoreSourceFile } from "src/project_analysis_types";
import type { ParsedConfigurationFilesContract, ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _Gitignore configuration selection_, _ignored path filtering_. **/
export class GitIgnoredPaths {
	private readonly _repo_root: string;
	private readonly _patterns_by_directory: Map<string, readonly GitIgnorePattern[]>;
	private readonly _ignore_cache: Map<string, boolean>;
	private readonly _directory_ignore_cache: Map<string, boolean>;
	private readonly _pattern_catalog: GitIgnorePatternCatalog;
	private readonly _parsed_configuration_files: ParsedConfigurationFilesContract;

	/** Responsibilities: _ignore patterns_. **/
	private directory_patterns(directories: readonly string[]): GitIgnorePattern[] {
		const global_files = [join(homedir(), ".gitignore_global"), join(homedir(), ".config", "git", "ignore")];
		const exclude_file = join(this._repo_root, ".git", "info", "exclude");
		const sources: GitIgnoreSourceFile[] = global_files.map((file) => ({ file, base_directory: this._repo_root }));
		sources.push({ file: exclude_file, base_directory: this._repo_root });
		sources.push(
			...directories.map((directory) => ({
				file: join(directory, GITIGNORE_FILE_NAME),
				base_directory: directory,
			})),
		);
		for (const source of sources) {
			this._parsed_configuration_files.add(source.file);
		}
		return this._pattern_catalog.patterns_from_files(sources);
	}

	/** Responsibilities: _repository directory ancestry_. **/
	private repository_directory_chain(directory_path: string): string[] {
		const directories: string[] = [];
		let current_directory = directory_path;
		while (true) {
			const inside_repository = current_directory === this._repo_root;
			const below_repository = current_directory.startsWith(`${this._repo_root}/`);
			if (!inside_repository && !below_repository) {
				break;
			}
			directories.unshift(current_directory);
			if (current_directory === this._repo_root) {
				break;
			}
			current_directory = dirname(current_directory);
		}
		return directories;
	}

	/** Responsibilities: _directory ignore pattern cache_. **/
	private patterns_for_directory(directory: string): readonly GitIgnorePattern[] {
		const absolute_directory = resolve(directory);
		const cached = this._patterns_by_directory.get(absolute_directory);
		if (cached !== undefined) {
			return cached;
		}
		const relation = new ProjectPathRelation(this._repo_root, absolute_directory);
		if (!relation.inside_root()) {
			return [];
		}
		const directories = this.repository_directory_chain(absolute_directory);
		const patterns = this.directory_patterns(directories);
		this._patterns_by_directory.set(absolute_directory, patterns);
		return patterns;
	}

	/** Responsibilities: _single file ignore decision_. **/
	private ignored_by_patterns(absolute_file: string): boolean {
		let ignored = false;
		for (const pattern of this.patterns_for_directory(dirname(absolute_file))) {
			if (this.matches(pattern, absolute_file, false)) {
				ignored = pattern.negated === false;
			}
		}
		return ignored;
	}

	/** Responsibilities: _uncached path decision_. **/
	private compute_ignore_decision(absolute_file: string): boolean {
		const relation = new ProjectPathRelation(this._repo_root, absolute_file);
		if (this.ignored_ancestor(relation)) {
			return true;
		}
		if (!relation.inside_root()) {
			return false;
		}
		return this.ignored_by_patterns(absolute_file);
	}

	/** Responsibilities: _single file ignore decision_. **/
	private ignored(file: string): boolean {
		const absolute_file = resolve(file);
		if (!this._ignore_cache.has(absolute_file)) {
			this._ignore_cache.set(absolute_file, this.compute_ignore_decision(absolute_file));
		}
		return this._ignore_cache.get(absolute_file) === true;
	}

	/** Responsibilities: _ignore pattern matching_. **/
	private matches(pattern: GitIgnorePattern, candidate: string, is_directory: boolean): boolean {
		if (pattern.directory_only && !is_directory) {
			return false;
		}
		const relation = new ProjectPathRelation(pattern.base_directory, candidate);
		if (!relation.inside_root()) {
			return false;
		}
		const relative_file = relation.path().split("\\").join("/");
		if (pattern.pattern.includes("/")) {
			return pattern.matcher.match_candidate(relative_file).matched;
		}
		if (pattern.anchored) {
			const first_segment = relative_file.replace(/[\\/].*$/u, "");
			return pattern.matcher.match_segments(first_segment).matched;
		}
		return pattern.matcher.match_segments(relative_file).matched;
	}

	/** Responsibilities: _parent directory ignore state_. **/
	private ignored_directory(directory: string): boolean {
		const absolute_directory = resolve(directory);
		const cached = this._directory_ignore_cache.get(absolute_directory);
		if (cached !== undefined) {
			return cached;
		}
		let ignored = false;
		for (const pattern of this.patterns_for_directory(dirname(absolute_directory))) {
			if (this.matches(pattern, absolute_directory, true)) {
				ignored = pattern.negated === false;
			}
		}
		this._directory_ignore_cache.set(absolute_directory, ignored);
		return ignored;
	}

	/** Responsibilities: _ordered ancestor ignore evaluation_. **/
	private ignored_ancestor(relation: ProjectPathRelationContract): boolean {
		const parts = relation.path().split(sep).slice(0, -1);
		let directory = this._repo_root;
		for (const part of parts) {
			directory = join(directory, part);
			if (this.ignored_directory(directory)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _Gitignore state initialization_. **/
	public constructor(repo_root: string, source_io: ProjectSourceIOContract) {
		this._patterns_by_directory = new Map<string, readonly GitIgnorePattern[]>();
		this._ignore_cache = new Map<string, boolean>();
		this._directory_ignore_cache = new Map<string, boolean>();
		this._pattern_catalog = new GitIgnorePatternCatalog(source_io);
		this._parsed_configuration_files = new Set<string>();
		this._repo_root = resolve(repo_root).replaceAll("\\", "/");
	}

	/** Responsibilities: _ignored path collection_. **/
	/** Responsibilities: _ignored file filtering_. **/
	public filter(files: readonly string[]): string[] {
		const visible_files: string[] = [];
		for (const file of files) {
			if (!this.ignored(file)) {
				visible_files.push(file);
			}
		}
		return visible_files;
	}

	/** Responsibilities: _ignore configuration reporting_. **/
	public configuration_files(): string[] {
		const configuration_files = [...this._parsed_configuration_files];
		configuration_files.sort();
		return configuration_files;
	}
}
