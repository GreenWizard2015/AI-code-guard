import type { CallableSourceImportScopeContract } from "src/analysis_protocols";
import type { StringReadonlySetMap } from "src/analysis_types";
import type { ParsedFile } from "src/metrics/types";
import type { ProjectSourceScannerContract } from "src/source_protocols";

/** Responsibilities: _callable source imports_, _source declaration scope_. **/
export class CallableSourceImportScope implements CallableSourceImportScopeContract {
	private readonly project_files: Set<string>;
	private readonly project_source_scanner: ProjectSourceScannerContract;
	private readonly imports_cache: StringReadonlySetMap;

	/** Responsibilities: _initialization callable source imports_. **/
	public constructor(project_files: readonly string[], project_source_scanner: ProjectSourceScannerContract) {
		this.imports_cache = new Map<string, ReadonlySet<string>>();
		this.project_files = new Set(project_files);
		this.project_source_scanner = project_source_scanner;
	}

	/** Responsibilities: _collection source import files_. **/
	public imports_for(file: string): ReadonlySet<string> {
		const cached = this.imports_cache.get(file);
		if (cached !== undefined) {
			return cached;
		}
		const imports = this.project_source_scanner.resolved_imports(file, this.project_files);
		this.imports_cache.set(file, imports);
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
