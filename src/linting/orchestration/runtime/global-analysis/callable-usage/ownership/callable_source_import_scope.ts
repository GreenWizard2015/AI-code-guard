import type { CallableSourceImportScopeContract } from "src/analysis_protocols";
import type { StringReadonlySetMap } from "src/analysis_types";
import type { ParsedFile } from "src/metrics/types";
import type { ProjectSourceScanContract } from "src/source_protocols";

/** Responsibilities: _callable source imports_, _source declaration scope_. **/
export class CallableSourceImportScope implements CallableSourceImportScopeContract {
	private readonly _project_files: Set<string>;
	private readonly _project_source_scanner: ProjectSourceScanContract;
	private readonly _imports_cache: StringReadonlySetMap;

	/** Responsibilities: _initialization callable source imports_. **/
	public constructor(project_files: readonly string[], project_source_scanner: ProjectSourceScanContract) {
		this._imports_cache = new Map<string, ReadonlySet<string>>();
		this._project_files = new Set(project_files);
		this._project_source_scanner = project_source_scanner;
	}

	/** Responsibilities: _collection source import files_. **/
	public imports_for(file: string): ReadonlySet<string> {
		const cached = this._imports_cache.get(file);
		if (cached !== undefined) {
			return cached;
		}
		const imports = this._project_source_scanner.imports(file, this._project_files).resolved_targets();
		this._imports_cache.set(file, imports);
		return imports;
	}

	/** Responsibilities: _source-visible file names_. **/
	public scope_files(file: ParsedFile): ReadonlySet<string> {
		const scope = new Set<string>([file.absolute_file]);
		for (const imported of file.imports) {
			scope.add(imported);
		}
		return scope;
	}
}
