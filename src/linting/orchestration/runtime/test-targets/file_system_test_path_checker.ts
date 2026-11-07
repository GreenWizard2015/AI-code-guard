import { dirname, isAbsolute, join } from "node:path";
import type { TestPathCheckerContract } from "src/testing_protocols";

/** Responsibilities: _test path normalization_, _filesystem path checks_. **/
export class FileSystemTestPathChecker implements TestPathCheckerContract {
	private readonly _project_root: string;
	private readonly _source_paths: ReadonlySet<string>;
	private readonly _source_directories: Set<string>;
	private readonly _index_state: Set<symbol>;
	private readonly _directory_index_ready: symbol;

	/** Responsibilities: _absolute filesystem path_. **/
	private absolute_path(path: string): string {
		if (isAbsolute(path)) {
			return path;
		}
		return join(this._project_root, path);
	}

	/** Responsibilities: _source directory index construction_. **/
	private index_source_directories(): void {
		if (this._index_state.has(this._directory_index_ready)) {
			return;
		}
		for (const source_path of this._source_paths) {
			let directory = dirname(source_path);
			while (directory !== dirname(directory)) {
				this._source_directories.add(directory);
				directory = dirname(directory);
			}
		}
		this._index_state.add(this._directory_index_ready);
	}

	/** Responsibilities: _initialization filesystem path checker_. **/
	public constructor(project_root: string, source_paths: readonly string[] = []) {
		this._directory_index_ready = Symbol("directory index ready");
		this._project_root = project_root;
		this._source_paths = new Set(source_paths.map((path) => this.absolute_path(path)));
		this._source_directories = new Set();
		this._index_state = new Set();
	}

	/** Responsibilities: _directory path inspection_. **/
	public directory(directory_path: string): boolean {
		this.index_source_directories();
		return this._source_directories.has(this.absolute_path(directory_path));
	}

	/** Responsibilities: _file path inspection_. **/
	public file(file_path: string): boolean {
		const absolute = this.absolute_path(file_path);
		return this._source_paths.has(absolute);
	}
}
