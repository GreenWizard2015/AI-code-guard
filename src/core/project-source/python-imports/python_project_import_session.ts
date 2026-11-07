import { PYTHON_EXTERNAL_MODULES, PYTHON_PACKAGE_SUFFIX } from "src/constants";
import { PythonRelativeImportPath } from "src/core/project-source/python-imports/python_relative_import_path";
import type { PythonImportFileIndexContract } from "src/python_protocols";
import type {
	PythonImportNamesRequest,
	PythonImportRequest,
	PythonImportSessionContract,
	PythonModuleSpecifierRequest,
} from "src/source_protocols";

/** Responsibilities: _Python source snapshot resolution_, _Python import expansion_. **/
export class PythonProjectImportSession implements PythonImportSessionContract {
	private readonly _root: string;
	private readonly _files: ReadonlySet<string>;
	private readonly _file_index: PythonImportFileIndexContract;
	private readonly _import_suffixes: readonly string[];

	/** Responsibilities: _absolute Python module path_. **/
	private absolute_path(specifier: string): string {
		const module_path = specifier.split(".").join("/");
		const module_file = `${module_path}.py`;
		const package_file = `${module_path}/__init__.py`;
		for (const import_root of this._file_index.for_root(this._root, this._files).import_roots()) {
			const candidates = this._file_index.for_root(import_root, this._files).absolute_import_index().imports();
			const package_candidate = candidates.get(package_file);
			if (package_candidate !== undefined) {
				return package_candidate.file;
			}
			const module_candidate = candidates.get(module_file);
			if (module_candidate !== undefined) {
				return module_candidate.file;
			}
		}
		return "";
	}

	/** Responsibilities: _namespace import recognition_. **/
	private namespace_import(first_part: string): boolean {
		for (const import_root of this._file_index.for_root(this._root, this._files).import_roots()) {
			if (this._file_index.for_root(import_root, this._files).importable_parts().has(first_part)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _from-import name expansion_. **/
	private from_import_names(request: PythonImportNamesRequest): string[] {
		const specifiers: string[] = [];
		for (const imported of request.item.names) {
			if (imported.name === "*") {
				continue;
			}
			const separator = request.item.module.endsWith(".") ? "" : ".";
			const candidate = `${request.item.module}${separator}${imported.name}`;
			const resolved_candidate = this.resolved_import_candidate(request.importer, candidate);
			if (resolved_candidate.length > 0) {
				specifiers.push(resolved_candidate);
			}
		}
		if (specifiers.length > 0) {
			return specifiers;
		}
		return [request.item.module];
	}

	/** Responsibilities: _import candidate validation_. **/
	private resolved_import_candidate(importer: string, candidate: string): string {
		const resolved_path = this.resolve_import({ importer, specifier: candidate });
		if (resolved_path.length === 0) {
			return "";
		}
		return candidate;
	}

	/** Responsibilities: _Python import snapshot initialization_. **/
	public constructor(root: string, files: ReadonlySet<string>, file_index: PythonImportFileIndexContract) {
		this._root = root;
		this._files = files;
		this._file_index = file_index;
		this._import_suffixes = [PYTHON_PACKAGE_SUFFIX, ".py", ""];
	}

	/** Responsibilities: _Python module candidate selection_. **/
	public select_import_candidate(base: string): string {
		for (const suffix of this._import_suffixes) {
			const candidate = `${base}${suffix}`;
			if (this._files.has(candidate)) {
				return candidate;
			}
		}
		return "";
	}

	/** Responsibilities: _Python import resolution_. **/
	public resolve_import(request: PythonImportRequest): string {
		if (request.specifier.startsWith(".")) {
			const relative_path = new PythonRelativeImportPath(request.importer, request.specifier);
			return this.select_import_candidate(relative_path.module_path());
		}
		return this.absolute_path(request.specifier);
	}

	/** Responsibilities: _Python project module classification_. **/
	public project_import(request: PythonModuleSpecifierRequest): boolean {
		const resolved_path = this.resolve_import({ importer: this._root, specifier: request.specifier });
		if (resolved_path.length > 0) {
			return true;
		}
		const first_part = request.specifier.split(".", 1).join(".");
		if (PYTHON_EXTERNAL_MODULES.has(first_part)) {
			return false;
		}
		return this.namespace_import(first_part);
	}

	/** Responsibilities: _Python import name expansion_. **/
	public import_names(request: PythonImportNamesRequest): string[] {
		if (request.item.kind === "import") {
			return [request.item.module];
		}
		return this.from_import_names(request);
	}
}
