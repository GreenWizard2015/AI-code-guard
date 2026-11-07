import type { PythonExportedSymbolResolverContract } from "src/contracts/protocols/composition_protocols";
import type { ProjectSourcePythonContract, PythonImportSessionContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _class names_, _protocol names_. **/
export type PythonClassDeclarations = {
	readonly class_names: ReadonlySet<string>;
	readonly protocol_names: ReadonlySet<string>;
};

/** Responsibilities: _production class declaration index_. **/
export interface PythonClassDeclarationsIndexContract {
	populate(sources: readonly LintSourceRecordData[]): void;
	values(): ReadonlyMap<string, PythonClassDeclarations>;
	files(): readonly string[];
	source_count(): number;
}

/** Responsibilities: _Python ownership dependencies_. **/
export type PythonClassOwnershipOptions = {
	readonly export_symbols: PythonExportedSymbolResolverContract;
	readonly project_imports: ProjectSourcePythonContract;
	readonly sources: readonly LintSourceRecordData[];
};

/** Responsibilities: _Python class ownership_, _project import access_, _export resolution_. **/

export interface PythonClassOwnershipStateContract {
	declarations(file: string): PythonClassDeclarations;
	import_session(): PythonImportSessionContract;
	exported_symbols(): PythonExportedSymbolResolverContract;
	project_sources_available(): boolean;
}
