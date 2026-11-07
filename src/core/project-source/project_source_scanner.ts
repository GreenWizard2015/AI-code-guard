import type { Dirent } from "node:fs";
import { readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import type { ReadonlyStringSetMap } from "src/analysis_types";
import { IGNORED_DIRECTORIES, PROJECT_PREFIXES, SOURCE_EXTENSIONS } from "src/constants";
import { ProjectSourceContextImports } from "src/core/project-source/project_source_context_imports";
import { ProjectSourceImportCache } from "src/core/project-source/project_source_import_cache";
import { ProjectSourceImports } from "src/core/project-source/project_source_imports";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { PythonProjectEntryPointUsages } from "src/core/project-source/python-imports/python_project_entry_point_usages";
import { ProjectSourceEntry } from "src/linting/orchestration/runtime/global-rules/project_source_entry";
import { ProjectSourceImportAnalysis } from "src/model/project_source_import_analysis";
import type { ProjectContextState, ProjectSourceOptions } from "src/model_types";
import type { ProjectSourceImportAnalysisContract } from "src/source_protocols";
import type {
	ProjectSourceContextImportsContract,
	ProjectSourceEntryContract,
	ProjectSourceScanContract,
} from "src/source_protocols";

/** Responsibilities: _project source graph scanning_, _unresolved import reporting_. **/
export class ProjectSourceScanner implements ProjectSourceScanContract {
	private readonly _root: string;
	private readonly _context_state: ProjectContextState;
	private readonly _source_entry: ProjectSourceEntryContract;
	private readonly _project_source_python: ProjectSourcePython;
	private readonly _project_source_imports: ProjectSourceImports;
	private readonly _context_imports: ProjectSourceContextImportsContract;
	private readonly _specifier_resolver: ProjectSourceImportCache;

	/** Responsibilities: _source file classification_. **/
	private project_source_file(name: string, path: string): boolean {
		if (!SOURCE_EXTENSIONS.has(extname(name))) {
			return false;
		}
		return PROJECT_PREFIXES.some((prefix) => path.startsWith(prefix));
	}

	/** Responsibilities: _project source path collection_. **/
	private collect_source_entry(directory: string, entry: Dirent, pending: string[], files: string[]): void {
		const file = join(directory, entry.name);
		if (entry.isDirectory()) {
			if (!IGNORED_DIRECTORIES.has(entry.name)) {
				pending.push(file);
			}
			return;
		}
		const path = relative(this._root, file).split("\\").join("/");
		if (entry.isFile() && this.project_source_file(entry.name, path)) {
			files.push(file);
		}
	}

	/** Responsibilities: _context source file selection_. **/
	private context_source_files(): string[] {
		const files: string[] = [];
		for (const source of this._context_state.value.files()) {
			if (SOURCE_EXTENSIONS.has(extname(source.absolute_path))) {
				files.push(source.absolute_path);
			}
		}
		return files;
	}

	/** Responsibilities: _project source tree traversal_. **/
	private discover_source_files(): string[] {
		const files: string[] = [];
		const pending = [this._root];
		while (pending.length > 0) {
			const directory = pending.pop();
			if (directory === undefined) {
				continue;
			}
			for (const entry of readdirSync(directory, { withFileTypes: true })) {
				this.collect_source_entry(directory, entry, pending, files);
			}
		}
		return files;
	}

	/** Responsibilities: _entry-reachable import expansion_. **/
	private append_reachable_imports(
		analysis: ProjectSourceImportAnalysisContract,
		available: Set<string>,
		reachable: Set<string>,
		pending: string[],
	): void {
		for (const imported of analysis.resolved_targets()) {
			if (available.has(imported) && !reachable.has(imported)) {
				pending.push(imported);
			}
		}
	}

	/** Responsibilities: _project entry classification_, _external entry-point lookup_. **/
	private entry_files(files: readonly string[], available: ReadonlySet<string>): string[] {
		const pending = files.filter((file) => this._source_entry.entry(file));
		for (const relative_file of this.external_symbol_usages().keys()) {
			const entry_file = resolve(this._root, relative_file);
			if (available.has(entry_file)) {
				pending.push(entry_file);
			}
		}
		return pending;
	}

	/** Responsibilities: _initialization project root file_. **/
	public constructor(root: string, options: ProjectSourceOptions) {
		this._project_source_python = new ProjectSourcePython(root);
		this._project_source_imports = new ProjectSourceImports(root);
		this._context_imports = new ProjectSourceContextImports(
			root,
			options.context_state.value,
			options.context_state.value.source_io(),
		);
		this._specifier_resolver = new ProjectSourceImportCache(
			options.context_state,
			this._project_source_imports,
			this._context_imports,
		);
		this._root = root;
		this._source_entry = new ProjectSourceEntry(root, options);
		this._context_state = options.context_state;
	}

	/** Responsibilities: _project source entry lookup_. **/
	public project_source_entry(): ProjectSourceEntryContract {
		return this._source_entry;
	}

	/** Responsibilities: _discovery supported project source_. **/
	public files(): string[] {
		if (this._context_state.available) {
			return this.context_source_files();
		}
		return this.discover_source_files();
	}

	/** Responsibilities: _entry-reachable source files_. **/
	public reachable_files(files: readonly string[]): ReadonlySet<string> {
		const available = new Set(files);
		const reachable = new Set<string>();
		const pending = this.entry_files(files, available);
		while (pending.length > 0) {
			const file = pending.pop();
			if (file === undefined || reachable.has(file)) {
				continue;
			}
			reachable.add(file);
			this.append_reachable_imports(this.imports(file, available), available, reachable, pending);
		}
		return reachable;
	}

	/** Responsibilities: _package entry-point usage_. **/
	public external_symbol_usages(): ReadonlyStringSetMap {
		const entry_point_usages = new PythonProjectEntryPointUsages(
			this._root,
			new Set(this.files()),
			this._context_state.value.source_io(),
		);
		return entry_point_usages.collect();
	}

	/** Responsibilities: _project import analysis_. **/
	public imports(file: string, files: Set<string>): ProjectSourceImportAnalysisContract {
		const analysis = new ProjectSourceImportAnalysis();
		const path = this._source_entry.relative_path(file);
		for (const specifier of this._specifier_resolver.import_specifiers(file, files)) {
			analysis.append(
				{
					file,
					path,
					specifier,
					files,
					python: this._project_source_python,
				},
				this._specifier_resolver,
			);
		}
		return analysis;
	}

	/** Responsibilities: _single import target resolution_. **/
	public resolved_import_path(file: string, specifier: string, files: Set<string>): string {
		return this._specifier_resolver.resolve({
			file,
			path: this._source_entry.relative_path(file),
			specifier,
			files,
			python: this._project_source_python,
		});
	}
}
