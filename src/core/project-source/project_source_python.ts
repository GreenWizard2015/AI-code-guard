import { dirname, join, relative } from "node:path";
import type { AbsoluteImportCandidate, AstPythonImport, PythonProjectImportExpansion } from "src/types";
import type {
	AbsoluteImportRootCache,
	AbsoluteImportRootIndex,
	ProjectSourcePythonContract,
	PythonImportFileIndexContract,
} from "src/protocols";
import { PYTHON_EXTERNAL_MODULES, PYTHON_PACKAGE_MARKER, PYTHON_PACKAGE_SUFFIX } from "src/constants";
import { PythonImportFileIndex } from "src/core/project-source/python_import_file_index";

/** Responsibilities: _absolute import resolution_, _relative import resolution_. **/
export class ProjectSourcePython implements ProjectSourcePythonContract {
	private readonly file_index: PythonImportFileIndexContract;
	private readonly import_suffixes = [PYTHON_PACKAGE_SUFFIX, ".py", ""] as const;
	private readonly absolute_import_cache: AbsoluteImportRootCache;

	/** Responsibilities: _package import path selection_. **/
	private package_path(root: string, parts: string[], start: number, files: ReadonlySet<string>): string {
		if (start === 0) {
			return parts.slice(start).join("/");
		}
		const module_path = parts.slice(start).join("/");
		if (!module_path.includes("/")) {
			return "";
		}
		const package_directory = join(root, ...parts.slice(0, start + 1));
		const directories = this.file_index.directories(files);
		if (files.has(join(package_directory, PYTHON_PACKAGE_MARKER))) {
			return module_path;
		}
		if (!directories.has(package_directory)) {
			return "";
		}
		return module_path;
	}

	/** Responsibilities: _absolute import candidate paths_. **/
	private import_paths(root: string, file: string, files: ReadonlySet<string>): string[] {
		const parts = relative(root, file).replaceAll("\\", "/").split("/");
		const path = this.package_path(root, parts, 0, files);
		if (path.length === 0) {
			return [];
		}
		return [path];
	}

	/** Responsibilities: _absolute import index addition_. **/
	private append_absolute_imports(
		index: Map<string, AbsoluteImportCandidate>,
		root: string,
		file: string,
		files: ReadonlySet<string>,
	): void {
		for (const module_path of this.import_paths(root, file, files)) {
			if (!index.has(module_path)) {
				index.set(module_path, { file });
			}
		}
	}

	/** Responsibilities: _root file import indexing_. **/
	private append_root_files(
		index: Map<string, AbsoluteImportCandidate>,
		root: string,
		root_files: readonly string[],
		files: ReadonlySet<string>,
	): void {
		for (const file of root_files) {
			this.append_absolute_imports(index, root, file, files);
		}
	}

	/** Responsibilities: _absolute Python import index_. **/
	private absolute_index(root: string, files: ReadonlySet<string>): Map<string, AbsoluteImportCandidate> {
		let roots = this.absolute_import_cache.get(files);
		if (roots === undefined) {
			roots = new Map();
			this.absolute_import_cache.set(files, roots);
		}
		const cached = roots.get(root);
		if (cached !== undefined) {
			return cached;
		}
		const index = new Map<string, AbsoluteImportCandidate>();
		const root_files = this.file_index.root_files(root, files);
		this.append_root_files(index, root, root_files, files);
		roots.set(root, index);
		return index;
	}

	/** Responsibilities: _absolute Python import resolution_. **/
	private absolute(root: string, specifier: string, files: ReadonlySet<string>): string {
		const module_file = `${specifier.split(".").join("/")}.py`;
		const package_file = `${specifier.split(".").join("/")}/__init__.py`;
		const index = this.absolute_index(root, files);
		const module_candidate = index.get(module_file);
		const package_candidate = index.get(package_file);
		if (package_candidate !== undefined) {
			return package_candidate.file;
		}
	if (module_candidate !== undefined) {
		return module_candidate.file;
	}
	return "";
	}

	/** Responsibilities: _relative import module path_. **/
	private relative_module_path(importer: string, specifier: string): string {
		let level = 0;
		while (specifier[level] === ".") {
			level += 1;
		}
		let base = dirname(importer);
		for (let index = 1; index < level; index += 1) {
			base = dirname(base);
		}
		const module = specifier.slice(level);
		if (module.length === 0) {
			return base;
		}
		return join(base, ...module.split("."));
	}

	/** Responsibilities: _relative Python import resolution_. **/
	private relative(importer: string, specifier: string, files: ReadonlySet<string>): string {
		const module_path = this.relative_module_path(importer, specifier);
		for (const suffix of this.import_suffixes) {
			const candidate = `${module_path}${suffix}`;
			if (files.has(candidate)) {
				return candidate;
			}
		}
		return "";
	}

	/** Responsibilities: _Python import expansion_. **/
	private append_resolved_names(options: PythonProjectImportExpansion): boolean {
		let resolved = false;
		for (const imported of options.names) {
			if (imported.name === "*") {
				continue;
			}
			const separator = options.module.endsWith(".") ? "" : ".";
			const candidate = `${options.module}${separator}${imported.name}`;
			if (this.python_import_path(options.root, options.importer, candidate, options.files).length === 0) {
				continue;
			}
			options.specifiers.push(candidate);
			resolved = true;
		}
		return resolved;
	}

	/** Responsibilities: _Python import resolver_. **/
	public constructor() {
		const file_index = new PythonImportFileIndex();
		this.file_index = file_index;
		this.absolute_import_cache = new WeakMap<ReadonlySet<string>, AbsoluteImportRootIndex>();
	}

	/** Responsibilities: _Python module candidate selection_. **/
	public select_import_candidate(base: string, files: ReadonlySet<string>): string {
		for (const suffix of this.import_suffixes) {
			const candidate = `${base}${suffix}`;
			if (files.has(candidate)) {
				return candidate;
			}
		}
		return "";
	}

	/** Responsibilities: _Python import path resolution_. **/
	public python_import_path(root: string, importer: string, specifier: string, files: ReadonlySet<string>): string {
		if (!specifier.startsWith(".")) {
			for (const import_root of this.file_index.import_roots(root, files)) {
				const resolved = this.absolute(import_root, specifier, files);
				if (resolved.length > 0) {
					return resolved;
				}
			}
			return "";
		}
		return this.relative(importer, specifier, files);
	}

	/** Responsibilities: _Python project import expansion_. **/
	public append_import_names(
		specifiers: string[],
		item: AstPythonImport,
		root: string,
		importer: string,
		files: ReadonlySet<string>,
	): void {
		if (item.kind === "import") {
			specifiers.push(item.module);
			return;
		}
		if (!this.append_resolved_names({ specifiers, module: item.module, names: item.names, root, importer, files })) {
			specifiers.push(item.module);
		}
	}

	/** Responsibilities: _Python import existence reporting_. **/
	public python_import(root: string, specifier: string, files: ReadonlySet<string>): boolean {
		const specifier_parts = specifier.split(".");
		const first_part = specifier_parts[0];
		if (this.python_import_path(root, root, specifier, files).length > 0) {
			return true;
		}
		if (PYTHON_EXTERNAL_MODULES.has(first_part)) {
			return false;
		}
		for (const import_root of this.file_index.import_roots(root, files)) {
			if (this.file_index.importable_parts(import_root, files).has(first_part)) {
				return true;
			}
		}
		return false;
	}
}
