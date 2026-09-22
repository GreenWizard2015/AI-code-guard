import { ProjectSourceDiscovery } from 'src/bridge/ts/project-source-discovery';
import { ProjectSourceImports } from 'src/bridge/ts/project-source-imports';
import { ProjectSourcePython } from 'src/project-source-python';
import { ProjectSourceEntry } from 'src/bridge/ts/runner/orchestration/runtime/project-source-entry';
import type {
	UnresolvedSpecifierInput,
	ProjectContextState,
	ProjectSourceOptions,
} from 'src/bridge/ts/runner/types';

/** Responsibilities: _discovery project files resolution_. **/
export class ProjectSourceScanner {
	private readonly root: string;
	private readonly context_state: ProjectContextState;
	private readonly project_source_entry: ProjectSourceEntry;
	private readonly project_source_python = new ProjectSourcePython();
	private readonly project_source_imports = new ProjectSourceImports();
	private readonly import_specifier_cache = new Map<string, string[]>();
	private readonly resolved_specifier_cache = new WeakMap<Set<string>, Map<string, string>>();

	/** Responsibilities: _collection import specifiers source_. **/
	private import_specifiers(file: string): string[] {
		const cached = this.import_specifier_cache.get(file);
		if (cached !== undefined) {
			return cached;
		}
		let specifiers: string[];
		if (this.context_state.available) {
			specifiers = this.project_source_imports.context_import_specifiers(file, this.context_state.value);
		} else {
			specifiers = this.project_source_imports.import_specifiers(file);
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
		if (input.specifier.startsWith('.')) {
			return true;
		}
return input.path.endsWith('.py') && input.python.python_import( this.root, input.specifier, input.files );
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
			return this.project_source_imports.context_specifier_path(
				this.root,
				input.file,
				input.specifier,
				input.files,
				this.context_state.value
			);
		}
		return this.project_source_imports.specifier_path(
			this.root,
			input.file,
			input.specifier,
			input.files,
		);
	}

	/** Responsibilities: _initialization project root file_. **/
	public constructor(root: string, options: ProjectSourceOptions) {
		this.root = root;
		this.project_source_entry = new ProjectSourceEntry(root, options);
		this.context_state = this.project_source_entry.context_state;
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
		for (const specifier of this.import_specifiers(file)) {
			unresolved.push(...this.unresolved_specifier({ file, path, specifier, files, python: this.project_source_python }));
		}
		return unresolved;
	}

	/** Responsibilities: _resolution project imports reachable_. **/
	public resolved_imports(file: string, files: Set<string>): Set<string> {
		const resolved = new Set<string>();
		for (const specifier of this.import_specifiers(file)) {
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
