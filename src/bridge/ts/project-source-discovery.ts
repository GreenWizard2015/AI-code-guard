import type { Dirent } from 'node:fs';
import { readdirSync } from 'node:fs';
import { relative, join, extname } from 'node:path';
import type { LintProjectContext } from 'src/protocols';
import { IGNORED_DIRECTORIES, PROJECT_PREFIXES, SOURCE_EXTENSIONS } from 'src/bridge/ts/parser/constants';

/** Responsibilities: _source files discovery projection_, _ignored paths filtering_. **/
export class ProjectSourceDiscovery {
	private readonly source_extensions = SOURCE_EXTENSIONS;
	private readonly ignored_directories = IGNORED_DIRECTORIES;
	private readonly project_prefixes = PROJECT_PREFIXES;

	/** Responsibilities: _source paths identification projection_. **/
	private is_project_source(name: string, path: string): boolean {
		if (!this.source_extensions.has(extname(name))) {
			return false;
		}
		return this.project_prefixes.some(prefix => path.startsWith(prefix));
	}

	/** Responsibilities: _directory entry collection_. **/
	private collect_directory_entry(
		root: string,
		directory: string,
		entry: Dirent,
		pending: string[],
		files: string[]
	): void {
		const file = join(directory, entry.name);
		if (entry.isDirectory()) {
			if (!this.ignored_directories.has(entry.name)) {
				pending.push(file);
			}
			return;
		}
		const path = relative(root, file).split('\\').join('/');
		if (entry.isFile() && this.is_project_source(entry.name, path)) {
			files.push(file);
		}
	}

	/** Responsibilities: _collection source files already_. **/
	public context_files(context: LintProjectContext): string[] {
		const files: string[] = [];
		for (const source of context.files()) {
			if (this.source_extensions.has(extname(source.absolute_path))) {
				files.push(source.absolute_path);
			}
		}
		return files;
	}

	/** Responsibilities: _root traversal projection_, _source files discovery_. **/
	public discover_files(root: string): string[] {
		const files: string[] = [];
		const pending = [root];
		while (pending.length > 0) {
			const directory = pending.pop();
			if (directory === undefined) {
				continue;
			}
			for (const entry of readdirSync(directory, { withFileTypes: true })) {
				this.collect_directory_entry(root, directory, entry, pending, files);
			}
		}
		return files;
	}
}
