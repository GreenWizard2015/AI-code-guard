import { readdirSync } from 'node:fs';
import { relative } from 'node:path';
import { join } from 'node:path';
import { DEFAULT_TARGET_FILES, IGNORED_DIRS } from 'src/constants';
import { SKIPPED_PATH_PARTS } from 'src/bridge/ts/core/constants';
import { GitIgnoredPaths } from 'src/bridge/ts/core/support/git-ignored-paths';

/** Responsibilities: _discovery supported source files_. **/
export class LintFileDiscovery {
	private readonly skipped_path_parts = SKIPPED_PATH_PARTS;
	private readonly ignored_dirs = IGNORED_DIRS;
	private readonly default_target_files = DEFAULT_TARGET_FILES;
	private readonly git_ignored_paths = new Map<string, GitIgnoredPaths>();

	/** Responsibilities: _Git ignore filter retrieval_. **/
	private git_filter(repo_root: string): GitIgnoredPaths {
		const existing = this.git_ignored_paths.get(repo_root);
		if (existing !== undefined) {
			return existing;
		}
		const created = new GitIgnoredPaths(repo_root);
		this.git_ignored_paths.set(repo_root, created);
		return created;
	}

	/** Responsibilities: _aggregation supported source path_. **/
	private append_source_file(repo_root: string, path: string, files: string[]): void {
		const relative_path = relative(repo_root, path);
		if (!(path.endsWith('.ts') || path.endsWith('.tsx') || path.endsWith('.py'))) {
			return;
		}
		if (this.skipped_path_parts.some(part => relative_path.split('\\').join('/').includes(part))) {
			return;
		}
		files.push(path);
	}

	/** Responsibilities: _recursively traversal directory collection_. **/
	private walk_directory(
		repo_root: string,
		root: string,
		files: string[],
		ignored_directories: ReadonlySet<string>
	): void {
		for (const entry of readdirSync(root, { withFileTypes: true })) {
			const path = join(root, entry.name);
			if (entry.isDirectory()) {
				if (!this.ignored_dirs.has(entry.name) && !ignored_directories.has(path.replaceAll('\\', '/'))) {
					this.walk_directory(repo_root, path, files, ignored_directories);
				}
				continue;
			}
			if (entry.isFile()) {
				this.append_source_file(repo_root, path, files);
			}
		}
	}

	/** Responsibilities: _normalization configuration target path_. **/
	private normalize_target_file(repo_root: string, value: string): string {
		const trimmed = value.trim();
		if (!trimmed) {
			return '';
		}
		let absolute = join(repo_root, trimmed);
		if (trimmed.startsWith('/')) {
			absolute = trimmed;
		}
		if (this.skipped_path_parts.some(part => relative(repo_root, absolute).includes(part))) {
			return '';
		}
		return absolute;
	}

	/** Responsibilities: _discovery supported source files_. **/
	public walk_files_under(
		repo_root: string,
		root: string,
		ignored_directories: ReadonlySet<string>
	): string[] {
		const files: string[] = [];
		this.walk_directory(repo_root, root, files, ignored_directories);
		files.sort();
		return this.git_filter(repo_root).filter(files);
	}

	/** Responsibilities: _target file normalization_. **/
	public target_files_env(repo_root: string): string[] {
		const raw_value = process.env.CODING_LINT_FILES?.trim();
		if (!raw_value) {
			return this.default_target_files;
		}
		const files = raw_value
			.split(',')
			.map(value => this.normalize_target_file(repo_root, value))
			.filter(value => value.length > 0);
		return this.git_filter(repo_root).filter(files);
	}
}
