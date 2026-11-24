import type { StringSet, StringStringMap } from "src/analysis_types";
import type { StringSetToStringMapCache } from "src/cache_types";
import type { ProjectContextState, UnresolvedSpecifierInput } from "src/model_types";
import type { ProjectSourceContextImportsContract, ProjectSourceImportCacheContract } from "src/source_protocols";
import type { ProjectSourceImportsContract } from "src/source_protocols";

/** Responsibilities: _project import path resolution_, _specifier classification_. **/
export class ProjectSourceImportCache implements ProjectSourceImportCacheContract {
	private readonly _context_state: ProjectContextState;
	private readonly _project_imports: ProjectSourceImportsContract;
	private readonly _context_imports: ProjectSourceContextImportsContract;
	private readonly _resolved_paths: StringSetToStringMapCache;
	private readonly _file_imports: Map<string, string[]>;

	/** Responsibilities: _file-set path cache_. **/
	private paths_for(files: StringSet): Map<string, string> {
		let paths = this._resolved_paths.get(files);
		if (paths === undefined) {
			paths = new Map<string, string>();
			this._resolved_paths.set(files, paths);
		}
		return paths;
	}

	/** Responsibilities: _initialization project import resolver_. **/
	public constructor(
		context_state: ProjectContextState,
		project_imports: ProjectSourceImportsContract,
		context_imports: ProjectSourceContextImportsContract,
	) {
		this._context_state = context_state;
		this._project_imports = project_imports;
		this._context_imports = context_imports;
		this._resolved_paths = new WeakMap<StringSet, StringStringMap>();
		this._file_imports = new Map<string, string[]>();
	}

	/** Responsibilities: _file import specifiers_. **/
	public import_specifiers(file: string, files: Set<string>): string[] {
		const cached = this._file_imports.get(file);
		if (cached !== undefined) {
			return cached;
		}
		let specifiers: string[];
		if (this._context_state.available) {
			specifiers = this._context_imports.imports(file);
		} else {
			specifiers = this._project_imports.import_specifiers(file, files);
		}
		this._file_imports.set(file, specifiers);
		return specifiers;
	}

	/** Responsibilities: _project import classification_. **/
	public should_check(input: UnresolvedSpecifierInput): boolean {
		if (input.specifier.startsWith(".")) {
			return true;
		}
		if (input.path.endsWith(".py")) {
			return input.python.for_files(input.files).project_import({ specifier: input.specifier });
		}
		if (this._context_state.available) {
			return this._context_imports.resolve(input.file, input.specifier).path_alias_configured();
		}
		return this._project_imports.path_alias_configured(input.specifier);
	}

	/** Responsibilities: _import path resolution_. **/
	public resolve(input: UnresolvedSpecifierInput): string {
		const cache = this.paths_for(input.files);
		const cache_key = `${input.file}\u0000${input.specifier}`;
		const cached = cache.get(cache_key);
		if (cached !== undefined) {
			return cached;
		}
		let resolved: string;
		if (this._context_state.available) {
			resolved = this._context_imports.resolve(input.file, input.specifier).path();
		} else {
			resolved = this._project_imports.specifier_path(input.file, input.specifier, input.files);
		}
		cache.set(cache_key, resolved);
		return resolved;
	}
}
