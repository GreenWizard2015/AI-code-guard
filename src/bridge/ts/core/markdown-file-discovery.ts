import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { relative } from 'node:path';
import { IGNORED_DIRS } from 'src/constants';
import { GitIgnoredPaths } from 'src/bridge/ts/core/support/git-ignored-paths';
import { CyrillicTextRules } from 'src/bridge/ts/rules/support/cyrillic-text-rules';
import type { Violation } from 'src/protocols';

/** Responsibilities: _Markdown file discovery_. **/
export class MarkdownFileDiscovery {
	private readonly ignored_directories = IGNORED_DIRS;
	private readonly text_rules = new CyrillicTextRules();
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

	/** Responsibilities: _Markdown directory traversal_. **/
	private walk_directory(
		repo_root: string,
		root: string,
		files: string[],
		configured_ignored: ReadonlySet<string>,
	): void {
		for (const entry of readdirSync(root, { withFileTypes: true })) {
			const path = join(root, entry.name);
			if (entry.isDirectory()) {
				const normalized_path = path.replaceAll('\\', '/');
				if (!this.ignored_directories.has(entry.name) && !configured_ignored.has(normalized_path)) {
					this.walk_directory(repo_root, path, files, configured_ignored);
				}
				continue;
			}
			if (entry.isFile() && entry.name.endsWith('.md')) {
				files.push(path);
			}
		}
	}

	/** Responsibilities: _Markdown path collection_. **/
	public files(repo_root: string, configured_ignored: ReadonlySet<string>): string[] {
		const files: string[] = [];
		this.walk_directory(repo_root, repo_root, files, configured_ignored);
		files.sort();
		return this.git_filter(repo_root).filter(files);
	}

	/** Responsibilities: _Markdown Cyrillic violations_. **/
	public violations(repo_root: string, configured_ignored: ReadonlySet<string>): Violation[] {
		return this.files(repo_root, configured_ignored).flatMap(file =>
			this.text_rules.markdown_violations(
				relative(repo_root, file).split('\\').join('/'),
				readFileSync(file, 'utf8'),
			),
		);
	}
}
