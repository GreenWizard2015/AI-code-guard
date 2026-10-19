import { dirname, join, relative, sep } from "node:path";
import type {
	PythonDirectoryFilesCache,
	PythonImportFileIndexContract,
	PythonImportPartCache,
	PythonImportRootCache,
	PythonImportRootMap,
} from "src/protocols";
import { PYTHON_PACKAGE_MARKER } from "src/constants";

/** Responsibilities: _project files_, _import indexes_. **/
export class PythonImportFileIndex implements PythonImportFileIndexContract {
	private readonly import_part_cache: PythonImportPartCache;
	private readonly directory_files_cache: PythonDirectoryFilesCache;
	private readonly import_roots_cache: PythonImportRootCache;

	/** Responsibilities: _directory descendant file registration_. **/
	private append_directory_file(file: string, directories: Map<string, string[]>): void {
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

	/** Responsibilities: _Python package root selection_. **/
	private package_root(root: string, directory: string, files: ReadonlySet<string>): string {
		if (!files.has(join(directory, PYTHON_PACKAGE_MARKER))) {
			return "";
		}
		const package_root = dirname(directory);
		if (package_root === root) {
			return "";
		}
		if (!package_root.startsWith(`${root}${sep}`)) {
			return "";
		}
		return package_root;
	}

	/** Responsibilities: _importable module part registration_. **/
	private append_import_parts(root: string, file: string, parts: Set<string>): void {
		const path_parts = relative(root, file).replaceAll("\\", "/").split("/");
		if (path_parts[0] === "..") {
			return;
		}
		const file_name = path_parts[path_parts.length - 1];
		if (path_parts.length === 1) {
			parts.add(file_name.replace(/\.py$/u, ""));
			return;
		}
		parts.add(path_parts[0]);
	}

	/** Responsibilities: _Python import root configuration_. **/
	private configured_import_roots(root: string, files: ReadonlySet<string>): string[] {
		const roots = [root];
		const directories = this.directories(files);
		const source_root = join(root, "src");
		if (directories.has(source_root)) {
			roots.push(source_root);
		}
		for (const directory of directories.keys()) {
			const package_root = this.package_root(root, directory, files);
			if (package_root.length > 0) {
				roots.push(package_root);
			}
		}
		return roots;
	}

	/** Responsibilities: _Python import file index_. **/
	public constructor() {
		this.import_part_cache = new WeakMap();
		this.directory_files_cache = new WeakMap();
		this.import_roots_cache = new WeakMap<ReadonlySet<string>, PythonImportRootMap>();
	}

	/** Responsibilities: _directory descendant file index_. **/
	public directories(files: ReadonlySet<string>): Map<string, string[]> {
		let directories = this.directory_files_cache.get(files);
		if (directories !== undefined) {
			return directories;
		}
		directories = new Map<string, string[]>();
		for (const file of files) {
			this.append_directory_file(file, directories);
		}
		this.directory_files_cache.set(files, directories);
		return directories;
	}

	/** Responsibilities: _root file selection_. **/
	public root_files(root: string, files: ReadonlySet<string>): readonly string[] {
		if (root === sep) {
			return [...files];
		}
		const indexed_root_files = this.directories(files).get(root);
		if (indexed_root_files === undefined) {
			return [];
		}
		return indexed_root_files;
	}

	/** Responsibilities: _importable Python module parts_. **/
	public importable_parts(root: string, files: ReadonlySet<string>): Set<string> {
		let roots = this.import_part_cache.get(files);
		if (roots === undefined) {
			roots = new Map();
			this.import_part_cache.set(files, roots);
		}
		const cached = roots.get(root);
		if (cached !== undefined) {
			return cached;
		}
		const parts = new Set<string>();
		for (const file of this.root_files(root, files)) {
			this.append_import_parts(root, file, parts);
		}
		roots.set(root, parts);
		return parts;
	}

	/** Responsibilities: _Python import root cache_. **/
	public import_roots(root: string, files: ReadonlySet<string>): readonly string[] {
		let cached_roots = this.import_roots_cache.get(files);
		if (cached_roots === undefined) {
			cached_roots = new Map<string, readonly string[]>();
			this.import_roots_cache.set(files, cached_roots);
		}
		const cached = cached_roots.get(root);
		if (cached !== undefined) {
			return cached;
		}
		const roots = this.configured_import_roots(root, files);
		cached_roots.set(root, roots);
		return roots;
	}
}
