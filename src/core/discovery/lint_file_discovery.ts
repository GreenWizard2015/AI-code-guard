import { dirname, relative, resolve } from "node:path";
import type { LintFileDiscoveryContract } from "src/analysis_protocols";
import { IGNORED_DIRS } from "src/constants";
import { SKIPPED_PATH_PARTS } from "src/core/constants";
import type { GitIgnoredPathsContract } from "src/runtime_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _supported source file discovery_, _ignored path filtering_. **/
export class LintFileDiscovery implements LintFileDiscoveryContract {
	private readonly _repo_root: string;
	private readonly _ignored_directories: ReadonlySet<string>;
	private readonly _skipped_path_parts: readonly string[];
	private readonly _ignored_dirs: ReadonlySet<string>;
	private readonly _git_ignored_paths: GitIgnoredPathsContract;
	private readonly _source_io: ProjectSourceIOContract;

	/** Responsibilities: _aggregation supported source path_. **/
	private append_source_file(path: string, files: string[]): void {
		const relative_path = relative(this._repo_root, path);
		if (this._skipped_path_parts.some((part) => relative_path.split("\\").join("/").includes(part))) {
			return;
		}
		files.push(path);
	}

	/** Responsibilities: _ignored ancestor matching_. **/
	private has_ignored_ancestor(file: string): boolean {
		let directory = dirname(file);
		while (directory !== this._repo_root) {
			if (this._ignored_directories.has(directory.replaceAll("\\", "/"))) {
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
	private ignored_path(file: string): boolean {
		const relative_path = relative(this._repo_root, file).replaceAll("\\", "/");
		if (relative_path === "..") {
			return true;
		}
		if (relative_path.startsWith("../")) {
			return true;
		}
		if (relative_path.split("/").some((part) => this._ignored_dirs.has(part))) {
			return true;
		}
		return this.has_ignored_ancestor(file);
	}

	/** Responsibilities: _source extension classification_. **/
	private supported_source_file(source_path: string): boolean {
		const extension = source_path.slice(source_path.lastIndexOf("."));
		switch (extension) {
			case ".ts":
			case ".tsx":
			case ".mts":
			case ".cts":
			case ".py":
				return true;
			default:
				return false;
		}
	}

	/** Responsibilities: _discovery supported source files_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor(
		repo_root: string,
		ignored_directories: ReadonlySet<string>,
		source_io: ProjectSourceIOContract,
		git_ignored_paths: GitIgnoredPathsContract,
	) {
		this._repo_root = repo_root;
		this._ignored_directories = ignored_directories;
		this._source_io = source_io;
		this._git_ignored_paths = git_ignored_paths;
		this._skipped_path_parts = SKIPPED_PATH_PARTS;
		this._ignored_dirs = IGNORED_DIRS;
	}
	/** Responsibilities: _public operation_. **/
	public walk_files_under(root: string): string[] {
		const absolute_root = resolve(root).replaceAll("\\", "/");
		const paths = this._source_io.source_paths(absolute_root, this._ignored_dirs);
		return this._git_ignored_paths.filter(this.walk_files_from(paths));
	}

	/** Responsibilities: _source file selection_. **/
	public walk_files_from(paths: readonly string[]): string[] {
		const files: string[] = [];
		for (const file of paths) {
			if (!this.supported_source_file(file)) {
				continue;
			}
			if (this.ignored_path(file)) {
				continue;
			}
			this.append_source_file(file, files);
		}
		files.sort();
		return files;
	}
}
