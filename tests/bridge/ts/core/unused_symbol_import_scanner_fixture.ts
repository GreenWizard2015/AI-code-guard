import type { ProjectSourceScannerContract } from "src/source_protocols";
import type { ReadonlyStringSetMap } from "src/analysis_types";

/** Responsibilities: _project import fixture_, _source scanner contract_. **/
export class ImportedSourceScanner implements ProjectSourceScannerContract {
	/** Responsibilities: _entry-point classification_. **/
	public entry(_file: string): boolean {
		return false;
	}

	/** Responsibilities: _external symbol usage fixture_. **/
	public external_symbol_usages(): ReadonlyStringSetMap {
		return new Map();
	}

	/** Responsibilities: _source file inventory_. **/
	public files(): string[] {
		return [];
	}

	/** Responsibilities: _single import target resolution_. **/
	public resolved_import_path(_file: string, _specifier: string, _available: Set<string>): string {
		return "dependency.py";
	}

	/** Responsibilities: _dependency path resolution_. **/
	public resolved_imports(_file: string, _available: Set<string>): Set<string> {
		return new Set(["dependency.py"]);
	}

	/** Responsibilities: _unresolved import collection_. **/
	public unresolved_relative_imports(_file: string, _available: ReadonlySet<string>): string[] {
		return [];
	}
}
