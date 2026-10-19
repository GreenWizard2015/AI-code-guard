import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { GitIgnorePatternCatalog } from "src/core/support/git_ignore_pattern_catalog";
import { ProjectPathRelation } from "src/core/support/project_path_relation";
import { GITIGNORE_FILE_NAME } from "src/constants";
import type {
	ParsedConfigurationFilesContract,
	ProjectPathRelationContract,
	ProjectSourceIOContract,
} from "src/protocols";
import type { GitIgnorePattern, GitIgnoreSourceFile } from "src/types";

/** Responsibilities: _Gitignore configuration selection_, _ignored path filtering_. **/
export class GitIgnoredPaths {
	private readonly repo_root: string;
	private readonly patterns_by_directory: Map<string, readonly GitIgnorePattern[]>;
	private readonly pattern_catalog: GitIgnorePatternCatalog;
	private readonly parsed_configuration_files: ParsedConfigurationFilesContract;
	private readonly source_io: ProjectSourceIOContract;

	/** Responsibilities: _repository parent directory collection_. **/
	private repository_directories(directory: string): string[] {
		const directories: string[] = [];
		let current_directory = resolve(directory);
		while (true) {
			const inside_repository = current_directory === this.repo_root;
			const below_repository = current_directory.startsWith(`${this.repo_root}/`);
			if (!inside_repository && !below_repository) {
				break;
			}
			directories.unshift(current_directory);
			if (current_directory === this.repo_root) {
				break;
			}
			current_directory = dirname(current_directory);
		}
		return directories;
	}

	/** Responsibilities: _ignore patterns_. **/
	private directory_patterns(directories: readonly string[]): GitIgnorePattern[] {
		const global_files = [join(homedir(), ".gitignore_global"), join(homedir(), ".config", "git", "ignore")];
		const exclude_file = join(this.repo_root, ".git", "info", "exclude");
		const sources: GitIgnoreSourceFile[] = global_files.map((file) => ({ file, base_directory: homedir() }));
		sources.push({ file: exclude_file, base_directory: this.repo_root });
		sources.push(
			...directories.map((directory) => ({
				file: join(directory, GITIGNORE_FILE_NAME),
				base_directory: directory,
			})),
		);
		for (const source of sources) {
			this.parsed_configuration_files.add(source.file);
		}
		return this.pattern_catalog.patterns_from_files(sources);
	}

	/** Responsibilities: _directory ignore pattern cache_. **/
	private patterns_for_directory(directory: string): readonly GitIgnorePattern[] {
		const absolute_directory = resolve(directory);
		const cached = this.patterns_by_directory.get(absolute_directory);
		if (cached !== undefined) {
			return cached;
		}
		const relation: ProjectPathRelationContract = new ProjectPathRelation(this.repo_root, absolute_directory);
		if (!relation.inside) {
			return [];
		}
		const patterns = this.directory_patterns(this.repository_directories(absolute_directory));
		this.patterns_by_directory.set(absolute_directory, patterns);
		return patterns;
	}

	/** Responsibilities: _file ignore pattern selection_. **/
	private ignore_files(file: string): readonly GitIgnorePattern[] {
		const absolute_file = resolve(file);
		const relation: ProjectPathRelationContract = new ProjectPathRelation(this.repo_root, absolute_file);
		if (!relation.inside) {
			return [];
		}
		return this.patterns_for_directory(dirname(absolute_file));
	}

	/** Responsibilities: _single file ignore decision_. **/
	private ignored(file: string): boolean {
		if (this.ignored_ancestor(file)) {
			return true;
		}
		let ignored = false;
		for (const pattern of this.ignore_files(file)) {
			if (this.matches(pattern, file, false)) {
				ignored = pattern.negated === false;
			}
		}
		return ignored;
	}

	/** Responsibilities: _slash pattern matching_. **/
	private slash_match(pattern: GitIgnorePattern, relative_file: string, is_directory: boolean): boolean {
		if (pattern.directory_only && !is_directory) {
			return false;
		}
		return pattern.matcher.match_candidate(relative_file).matched;
	}

	/** Responsibilities: _segment pattern matching_. **/
	private segment_match(pattern: GitIgnorePattern, relative_file: string, is_directory: boolean): boolean {
		if (pattern.directory_only && !is_directory) {
			return false;
		}
		return pattern.matcher.match_segments(relative_file).matched;
	}

	/** Responsibilities: _anchored basename matching_. **/
	private anchored_segment_match(
		pattern: GitIgnorePattern,
		relative_file: string,
		is_directory: boolean,
	): boolean {
		if (pattern.directory_only && !is_directory) {
			return false;
		}
		const first_segment = relative_file.replace(/[\\/].*$/u, "");
		return pattern.matcher.match_segments(first_segment).matched;
	}

	/** Responsibilities: _ignore pattern matching_. **/
	private matches(pattern: GitIgnorePattern, file: string, is_directory: boolean): boolean {
		const pattern_relative_path = relative(pattern.base_directory, file);
		if (isAbsolute(pattern_relative_path) || pattern_relative_path === "..") {
			return false;
		}
		if (pattern_relative_path.startsWith(`..${sep}`)) {
			return false;
		}
		const relative_file = pattern_relative_path.split("\\").join("/");
		if (pattern.pattern.includes("/")) {
			return this.slash_match(pattern, relative_file, is_directory);
		}
		if (pattern.anchored) {
			return this.anchored_segment_match(pattern, relative_file, is_directory);
		}
		return this.segment_match(pattern, relative_file, is_directory);
	}

	/** Responsibilities: _parent directory ignore state_. **/
	private ignored_directory(directory: string): boolean {
		let ignored = false;
		for (const pattern of this.patterns_for_directory(dirname(directory))) {
			if (this.matches(pattern, directory, true)) {
				ignored = pattern.negated === false;
			}
		}
		return ignored;
	}

	/** Responsibilities: _ordered ancestor ignore evaluation_. **/
	private ignored_ancestor(file: string): boolean {
		const relation: ProjectPathRelationContract = new ProjectPathRelation(this.repo_root, file);
		const parts = relation.relative_path.split(sep).slice(0, -1);
		let directory = this.repo_root;
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
		this.patterns_by_directory = new Map<string, readonly GitIgnorePattern[]>();
		this.pattern_catalog = new GitIgnorePatternCatalog(source_io);
		this.parsed_configuration_files = new Set<string>();
		this.source_io = source_io;
		this.repo_root = resolve(repo_root).replaceAll("\\", "/");
	}

	/** Responsibilities: _ignored path collection_. **/
	/** Responsibilities: _ignored file filtering_. **/
	public filter(files: readonly string[]): string[] {
		const ignored = new Set(
			files.filter((file) => this.ignored(file)).map((file) => relative(this.repo_root, file).split("\\").join("/")),
		);
		return files.filter((file) => {
			const relative_file = relative(this.repo_root, file).split("\\").join("/");
			return !ignored.has(relative_file);
		});
	}

	/** Responsibilities: _ignore configuration reporting_. **/
	public configuration_files(): string[] {
		const configuration_files = [...this.parsed_configuration_files];
		const existing_files = configuration_files.filter((file) => this.source_io.source_available(file));
		existing_files.sort();
		return existing_files;
	}
}
