import type { ReadonlyStringSetMap } from "src/analysis_types";
import { ProjectSourceImportAnalysis } from "src/model/project_source_import_analysis";
import type { ProjectSourceScanContract } from "src/source_protocols";
import type { ProjectSourceClassification, ProjectSourceEntryContract, ProjectSourcePath } from "src/source_protocols";

/** Responsibilities: _project import fixture_, _source scanner contract_, _entry classification_. **/
export class ImportedSourceScanner implements ProjectSourceScanContract, ProjectSourceEntryContract {
	private readonly _imported_files: readonly string[];
	private readonly _resolved_target: string;
	private _resolved_path_count = 0;

	/** Responsibilities: _import scanner fixture initialization_. **/
	public constructor(imported_files: readonly string[] = ["dependency.py"], resolved_target = "dependency.py") {
		this._imported_files = imported_files;
		this._resolved_target = resolved_target;
	}

	/** Responsibilities: _fixture project source entry_. **/
	public project_source_entry(): ProjectSourceEntryContract {
		return this;
	}

	/** Responsibilities: _entry-point file membership_. **/
	public entry_point_files(): ReadonlySet<string> {
		return new Set();
	}

	/** Responsibilities: _fixture relative path_. **/
	public project_path(absolute_path: string): ProjectSourcePath {
		return { absolute: absolute_path, relative: absolute_path };
	}

	/** Responsibilities: _fixture entry classification_. **/
	public classification(_source: ProjectSourcePath): ProjectSourceClassification {
		return { entry: false, entry_point: false };
	}

	/** Responsibilities: _project entry-point file classification_. **/
	public configured_entries(_source_files: readonly string[]): string[] {
		return [];
	}

	/** Responsibilities: _external symbol usage fixture_. **/
	public external_symbol_usages(): ReadonlyStringSetMap {
		return new Map();
	}

	/** Responsibilities: _source file inventory_. **/
	public files(): string[] {
		return [];
	}

	/** Responsibilities: _fixture entry-reachable source files_. **/
	public reachable_files(_files: readonly string[]): ReadonlySet<string> {
		return new Set();
	}

	/** Responsibilities: _single import target resolution_. **/
	public resolved_import_path(_file: string, _specifier: string, _available: Set<string>): string {
		this._resolved_path_count += 1;
		return this._resolved_target;
	}

	/** Responsibilities: _import-resolution operation count_. **/
	public resolved_path_count(): number {
		return this._resolved_path_count;
	}

	/** Responsibilities: _fixture import analysis_. **/
	public imports(_file: string, _available: Set<string>): ProjectSourceImportAnalysis {
		const analysis = new ProjectSourceImportAnalysis();
		for (const file of this._imported_files) {
			analysis.add_resolved(file);
		}
		return analysis;
	}
}
