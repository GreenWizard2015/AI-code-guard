import { dirname, relative, resolve } from "node:path";
import { SKIPPED_PATH_PARTS } from "src/core/constants";
import { GitIgnoredPaths } from "src/git_ignored_paths";
import { IGNORED_DIRS } from "src/constants";
import type { GitIgnoredPathsContract } from "src/runtime_protocols";
import type { LintFileDiscoveryContract } from "src/analysis_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _supported source file discovery_, _ignored path filtering_. **/
export class LintFileDiscovery implements LintFileDiscoveryContract {
	private readonly skipped_path_parts = SKIPPED_PATH_PARTS;
	private readonly ignored_dirs = IGNORED_DIRS;
	private readonly git_ignored_paths: Map<string, GitIgnoredPathsContract>;
	private readonly source_io: ProjectSourceIOContract;

	/** Responsibilities: _git ignore paths_. **/
	private git_filter(repo_root: string): GitIgnoredPathsContract {
		const existing = this.git_ignored_paths.get(repo_root);
		if (existing !== undefined) {
			return existing;
		}
		const created = new GitIgnoredPaths(repo_root, this.source_io);
		this.git_ignored_paths.set(repo_root, created);
		return created;
	}

	/** Responsibilities: _aggregation supported source path_. **/
	private append_source_file(repo_root: string, path: string, files: string[]): void {
		const relative_path = relative(repo_root, path);
		if (!(path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".py"))) {
			return;
		}
		if (this.skipped_path_parts.some((part) => relative_path.split("\\").join("/").includes(part))) {
			return;
		}
		files.push(path);
	}

	/** Responsibilities: _ignored ancestor matching_. **/
	private has_ignored_ancestor(repo_root: string, file: string, ignored_directories: ReadonlySet<string>): boolean {
		let directory = dirname(file);
		while (directory !== repo_root && relative(repo_root, directory) !== "..") {
			if (ignored_directories.has(directory.replaceAll("\\", "/"))) {
				return true;
			}
			const parent = dirname(directory);
			if (parent === directory) {
				return true;
			}
			directory = parent;
		}
		return false;
	}

	/** Responsibilities: _recursively traversal directory collection_. **/
	private ignored_path(repo_root: string, file: string, ignored_directories: ReadonlySet<string>): boolean {
		const relative_path = relative(repo_root, file).replaceAll("\\", "/");
		if (relative_path === "..") {
			return true;
		}
		if (relative_path.startsWith("../")) {
			return true;
		}
		if (relative_path.split("/").some((part) => this.ignored_dirs.has(part))) {
			return true;
		}
		return this.has_ignored_ancestor(repo_root, file, ignored_directories);
	}

	/** Responsibilities: _discovery supported source files_. **/
	/** Responsibilities: _field initialization_. **/
	constructor(source_io: ProjectSourceIOContract) {
		this.git_ignored_paths = new Map<string, GitIgnoredPathsContract>();
		this.source_io = source_io;
	}
	/** Responsibilities: _public operation_. **/
	public walk_files_under(repo_root: string, root: string, ignored_directories: ReadonlySet<string>): string[] {
		const files = this.walk_files_raw(repo_root, root, ignored_directories);
		const ignored_paths = this.git_filter(repo_root);
		return ignored_paths.filter(files);
	}

	/** Responsibilities: _raw source files_. **/
	public walk_files_raw(repo_root: string, root: string, ignored_directories: ReadonlySet<string>): string[] {
		const files: string[] = [];
		const absolute_root = resolve(root).replaceAll("\\", "/");
		for (const file of this.source_io.source_paths(absolute_root, this.ignored_dirs)) {
			if (this.ignored_path(resolve(repo_root).replaceAll("\\", "/"), file, ignored_directories)) {
				continue;
			}
			this.append_source_file(repo_root, file, files);
		}
		files.sort();
		return files;
	}
}
