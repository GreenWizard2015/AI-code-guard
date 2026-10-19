import type { ProjectSourceScannerContract } from "src/protocols";

/** Responsibilities: _project import fixture_, _source scanner contract_. **/
export class ImportedSourceScanner implements ProjectSourceScannerContract {
	/** Responsibilities: _entry-point classification_. **/
	public entry(_file: string): boolean {
		return false;
	}

	/** Responsibilities: _source file inventory_. **/
	public files(): string[] {
		return [];
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
