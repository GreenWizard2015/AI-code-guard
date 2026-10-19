import { ProjectSourceDiscovery } from "src/core/project-source/project_source_discovery";
import { ProjectSourceImports } from "src/core/project-source/project_source_imports";
import { ProjectSourceContextImports } from "src/core/project-source/project_source_context_imports";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { ProjectSourceEntry } from "src/linting/orchestration/runtime/global-rules/project_source_entry";
import type { UnresolvedSpecifierInput, ProjectContextState, ProjectSourceOptions } from "src/model/types/types";
import type {
	ProjectSourceEntryContract,
	ProjectSourceContextImportsContract,
	ProjectSourceScannerContract,
	StringSet,
	StringStringMap,
	StringSetToStringMapCache,
} from "src/protocols";

/** Responsibilities: _project source graph scanning_, _unresolved import reporting_. **/
export class ProjectSourceScanner implements ProjectSourceScannerContract {
	private readonly root: string;
	private readonly context_state: ProjectContextState;
	private readonly project_source_entry: ProjectSourceEntryContract;
	private readonly project_source_python: ProjectSourcePython;
	private readonly project_source_imports: ProjectSourceImports;
	private readonly context_imports: ProjectSourceContextImportsContract;
	private readonly import_specifier_cache: Map<string, string[]>;
	private readonly resolved_specifier_cache: StringSetToStringMapCache;

	/** Responsibilities: _collection import specifiers source_. **/
	private import_specifiers(file: string, files: Set<string>): string[] {
		const cached = this.import_specifier_cache.get(file);
		if (cached !== undefined) {
			return cached;
		}
		let specifiers: string[];
		if (this.context_state.available) {
			specifiers = this.context_imports.imports(file);
		} else {
			specifiers = this.project_source_imports.import_specifiers(file, this.root, files);
		}
		this.import_specifier_cache.set(file, specifiers);
		return specifiers;
	}

	/** Responsibilities: _collection unresolved relative import_. **/
	private unresolved_specifier(input: UnresolvedSpecifierInput): string[] {
		if (!this.should_check_specifier(input)) {
			return [];
		}
		if (this.resolved_specifier(input).length > 0) {
			return [];
		}
		return [input.specifier];
	}

	/** Responsibilities: _classification import specifier project-relative_. **/
	private should_check_specifier(input: UnresolvedSpecifierInput): boolean {
		if (input.specifier.startsWith(".")) {
			return true;
		}
		if (input.path.endsWith(".py")) {
			return input.python.python_import(this.root, input.specifier, input.files);
		}
		if (this.context_state.available) {
			return this.context_imports.path_alias_configured(input.file, input.specifier);
		}
		return this.project_source_imports.path_alias_configured(this.root, input.specifier);
	}

	/** Responsibilities: _resolution import specifier project_. **/
	private resolved_specifier(input: UnresolvedSpecifierInput): string {
		let cache = this.resolved_specifier_cache.get(input.files);
		if (cache === undefined) {
			cache = new Map<string, string>();
			this.resolved_specifier_cache.set(input.files, cache);
		}
		const cache_key = `${input.file}\u0000${input.specifier}`;
		const cached = cache.get(cache_key);
		if (cached !== undefined) {
			return cached;
		}
		const resolved = this.specifier_path(input);
		cache.set(cache_key, resolved);
		return resolved;
	}

	/** Responsibilities: _normalization filesystem path represented_. **/
	private specifier_path(input: UnresolvedSpecifierInput): string {
		if (this.context_state.available) {
			return this.context_imports.path(input.file, input.specifier);
		}
		return this.project_source_imports.specifier_path(this.root, input.file, input.specifier, input.files);
	}

	/** Responsibilities: _initialization project root file_. **/
	public constructor(root: string, options: ProjectSourceOptions) {
		this.project_source_python = new ProjectSourcePython();
		this.project_source_imports = new ProjectSourceImports();
		this.context_imports = new ProjectSourceContextImports(
			root,
			options.context_state.value,
			options.context_state.value.source_io,
		);
		this.import_specifier_cache = new Map<string, string[]>();
		this.resolved_specifier_cache = new WeakMap<StringSet, StringStringMap>();
		this.root = root;
		this.project_source_entry = new ProjectSourceEntry(root, options);
		this.context_state = options.context_state;
	}

	/** Responsibilities: _discovery supported project source_. **/
	public files(): string[] {
		const project_source_discovery = new ProjectSourceDiscovery();
		if (this.context_state.available) {
			return project_source_discovery.context_files(this.context_state.value);
		}
		return project_source_discovery.discover_files(this.root);
	}

	/** Responsibilities: _classification source file analysis_. **/
	public entry(file: string): boolean {
		if (file === this.root) {
			return false;
		}
		return this.project_source_entry.entry(file);
	}

	/** Responsibilities: _reporting unresolved relative imports_. **/
	public unresolved_relative_imports(file: string, files: Set<string>): string[] {
		const unresolved: string[] = [];
		const path = this.project_source_entry.relative_path(file);
		for (const specifier of this.import_specifiers(file, files)) {
			unresolved.push(
				...this.unresolved_specifier({ file, path, specifier, files, python: this.project_source_python }),
			);
		}
		return unresolved;
	}

	/** Responsibilities: _resolution project imports reachable_. **/
	public resolved_imports(file: string, files: Set<string>): Set<string> {
		const resolved = new Set<string>();
		for (const specifier of this.import_specifiers(file, files)) {
			const imported = this.resolved_specifier({
				file,
				path: this.project_source_entry.relative_path(file),
				specifier,
				files,
				python: this.project_source_python,
			});
			if (imported) {
				resolved.add(imported);
			}
		}
		return resolved;
	}
}
