import { dirname, sep } from "node:path";
import { PythonImportRootIndex } from "src/core/project-source/python-imports/python_import_root_index";
import type { PythonImportFileIndexContract } from "src/python_protocols";
import type { PythonDirectoryFilesCache, PythonDirectoryMap, PythonImportRootCache } from "src/python_types";
import type { PythonImportRootIndexContract } from "src/python_types";

/** Responsibilities: _directory descendant file index_, _Python import root index_, _source snapshot cache_. **/
export class PythonImportFileIndex implements PythonImportFileIndexContract {
	private readonly _directory_files_cache: PythonDirectoryFilesCache;
	private readonly _root_indexes: PythonImportRootCache;

	/** Responsibilities: _directory descendant file registration_. **/
	private append_directory_file(file: string, directories: PythonDirectoryMap): void {
		let current = dirname(file);
		while (current !== sep && current.length > 0) {
			let directory_files = directories.get(current);
			if (directory_files === undefined) {
				directory_files = [];
			}
			directory_files.push(file);
			directories.set(current, directory_files);
			current = dirname(current);
		}
	}

	/** Responsibilities: _Python import index dependencies_. **/
	public constructor() {
		this._directory_files_cache = new WeakMap();
		this._root_indexes = new WeakMap();
	}

	/** Responsibilities: _directory descendant file index_. **/
	public directories(files: ReadonlySet<string>): PythonDirectoryMap {
		let directories = this._directory_files_cache.get(files);
		if (directories === undefined) {
			directories = new Map();
			for (const file of files) {
				this.append_directory_file(file, directories);
			}
			this._directory_files_cache.set(files, directories);
		}
		return directories;
	}

	/** Responsibilities: _Python import root view_. **/
	public for_root(root: string, files: ReadonlySet<string>): PythonImportRootIndexContract {
		let indexes = this._root_indexes.get(files);
		if (indexes === undefined) {
			indexes = new Map();
			this._root_indexes.set(files, indexes);
		}
		let index = indexes.get(root);
		if (index === undefined) {
			index = new PythonImportRootIndex(root, files, this.directories(files));
			indexes.set(root, index);
		}
		return index;
	}
}
