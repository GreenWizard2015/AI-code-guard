import { dirname, join, relative, sep } from "node:path";
import { PYTHON_PACKAGE_MARKER } from "src/constants";
import { PythonAbsoluteImportIndex } from "src/core/project-source/python-imports/python_absolute_import_index";
import { ProjectPathRelation } from "src/core/support/project_path_relation";
import type {
	PythonAbsoluteImportIndexContract,
	PythonImportPartCache,
	PythonImportRootIndexContract,
} from "src/python_types";

/** Responsibilities: _Python import root files_, _importable modules_. **/
export class PythonImportRootIndex implements PythonImportRootIndexContract {
	private readonly _root: string;
	private readonly _files: ReadonlySet<string>;
	private readonly _directories: ReadonlyMap<string, readonly string[]>;
	private readonly _parts_cache: PythonImportPartCache;
	private readonly _roots_cache: Map<string, readonly string[]>;
	private readonly _import_index: PythonAbsoluteImportIndexContract;

	/** Responsibilities: _Python package root selection_. **/
	private package_root(directory: string): string {
		if (!this._files.has(join(directory, PYTHON_PACKAGE_MARKER))) {
			return "";
		}
		const package_root = dirname(directory);
		if (package_root === this._root) {
			return "";
		}
		if (!package_root.startsWith(`${this._root}${sep}`)) {
			return "";
		}
		return package_root;
	}

	/** Responsibilities: _importable module part registration_. **/
	private append_import_part(file: string, parts: Set<string>): void {
		const relation = new ProjectPathRelation(this._root, file);
		const relative_file = relation.path().replaceAll("\\", "/");
		if (relative_file === ".." || relative_file.startsWith("../")) {
			return;
		}
		const file_name = relative_file.slice(relative_file.lastIndexOf("/") + 1);
		const root_separator = relative_file.indexOf("/");
		if (root_separator === -1) {
			parts.add(file_name.replace(/\.py$/u, ""));
			return;
		}
		parts.add(relative_file.slice(0, root_separator));
	}

	/** Responsibilities: _Python module directory discovery_. **/
	private module_directories(): Set<string> {
		const module_directories = new Set<string>();
		for (const [directory, files] of this._directories) {
			if (files.some((file) => file.endsWith(".py") && dirname(file) === directory)) {
				module_directories.add(directory);
			}
		}
		return module_directories;
	}

	/** Responsibilities: _namespace package ancestor selection_. **/
	private namespace_roots(): Set<string> {
		const namespace_roots = new Set<string>();
		const module_directories = this.module_directories();
		for (const directory of module_directories) {
			let ancestor = dirname(directory);
			while (ancestor !== this._root && ancestor.startsWith(`${this._root}${sep}`)) {
				if (module_directories.has(ancestor)) {
					namespace_roots.add(ancestor);
				}
				const parent = dirname(ancestor);
				if (parent === ancestor) {
					break;
				}
				ancestor = parent;
			}
		}
		return namespace_roots;
	}

	/** Responsibilities: _namespace root depth ordering_. **/
	private ordered_namespace_roots(namespace_roots: ReadonlySet<string>): string[] {
		const ordered_roots = [...namespace_roots];
		ordered_roots.sort((left, right) => {
			const left_depth = relative(this._root, left).split(sep).length;
			const right_depth = relative(this._root, right).split(sep).length;
			return left_depth - right_depth;
		});
		return ordered_roots;
	}

	/** Responsibilities: _Python import root selection_. **/
	private root_selection(): readonly string[] {
		const roots = [this._root];
		const source_root = join(this._root, "src");
		if (this._directories.has(source_root)) {
			roots.push(source_root);
		}
		for (const namespace_root of this.ordered_namespace_roots(this.namespace_roots())) {
			if (!roots.includes(namespace_root)) {
				roots.push(namespace_root);
			}
		}
		for (const directory of this._directories.keys()) {
			const package_root = this.package_root(directory);
			if (package_root.length > 0) {
				roots.push(package_root);
			}
		}
		return roots;
	}

	/** Responsibilities: _importable Python module parts_. **/
	private collect_import_parts(): Set<string> {
		const parts = new Set<string>();
		for (const file of this.root_files()) {
			this.append_import_part(file, parts);
		}
		return parts;
	}

	/** Responsibilities: _Python import root state_. **/
	public constructor(root: string, files: ReadonlySet<string>, directories: ReadonlyMap<string, readonly string[]>) {
		this._root = root;
		this._files = files;
		this._directories = directories;
		this._parts_cache = new Map();
		this._roots_cache = new Map();
		const root_files = directories.get(root);
		if (root_files === undefined) {
			this._import_index = new PythonAbsoluteImportIndex(root, []);
		} else {
			this._import_index = new PythonAbsoluteImportIndex(root, root_files);
		}
	}

	/** Responsibilities: _absolute import lookup_. **/
	public absolute_import_index(): PythonAbsoluteImportIndexContract {
		return this._import_index;
	}

	/** Responsibilities: _root file selection_. **/
	public root_files(): readonly string[] {
		if (this._root === sep) {
			return [...this._files];
		}
		const indexed_root_files = this._directories.get(this._root);
		if (indexed_root_files === undefined) {
			return [];
		}
		return indexed_root_files;
	}

	/** Responsibilities: _importable Python module parts_. **/
	public importable_parts(): Set<string> {
		let parts = this._parts_cache.get("parts");
		if (parts === undefined) {
			parts = this.collect_import_parts();
			this._parts_cache.set("parts", parts);
		}
		return parts;
	}

	/** Responsibilities: _Python import roots_. **/
	public import_roots(): readonly string[] {
		let roots = this._roots_cache.get("roots");
		if (roots === undefined) {
			roots = this.root_selection();
			this._roots_cache.set("roots", roots);
		}
		return roots;
	}
}
