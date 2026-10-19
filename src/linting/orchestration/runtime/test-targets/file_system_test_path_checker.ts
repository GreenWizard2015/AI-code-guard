import { dirname, isAbsolute, join } from "node:path";
import type { TestPathCheckerContract } from "src/core/context/protocols";
import { SOURCE_DIRECTORY_INDEX_READY } from "src/linting/orchestration/runtime/test-targets/constants";

/** Responsibilities: _test path normalization_, _filesystem path checks_. **/
export class FileSystemTestPathChecker implements TestPathCheckerContract {
	private readonly project_root: string;
	private readonly source_paths: ReadonlySet<string>;
	private readonly source_directories: Set<string>;
	private readonly index_state: Set<symbol>;

	/** Responsibilities: _absolute filesystem path_. **/
	private absolute_path(path: string): string {
		if (isAbsolute(path)) {
			return path;
		}
		return join(this.project_root, path);
	}

	/** Responsibilities: _source directory index construction_. **/
	private index_source_directories(): void {
		if (this.index_state.has(SOURCE_DIRECTORY_INDEX_READY)) {
			return;
		}
		for (const source_path of this.source_paths) {
			let directory = dirname(source_path);
			while (directory !== dirname(directory)) {
				this.source_directories.add(directory);
				directory = dirname(directory);
			}
		}
		this.index_state.add(SOURCE_DIRECTORY_INDEX_READY);
	}

	/** Responsibilities: _initialization filesystem path checker_. **/
	public constructor(project_root: string, source_paths: readonly string[] = []) {
		this.project_root = project_root;
		this.source_paths = new Set(source_paths.map((path) => this.absolute_path(path)));
		this.source_directories = new Set();
		this.index_state = new Set();
	}

	/** Responsibilities: _directory path inspection_. **/
	public directory(path: string): boolean {
		this.index_source_directories();
		return this.source_directories.has(this.absolute_path(path));
	}

	/** Responsibilities: _file path inspection_. **/
	public file(path: string): boolean {
		const absolute = this.absolute_path(path);
		return this.source_paths.has(absolute);
	}
}
