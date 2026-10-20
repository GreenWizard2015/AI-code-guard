import type { UnusedSymbolDefinition } from "src/core/types";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { LintSourceRecord } from "src/source_types";

export type GlobalViolationCollectorOptions = {
	repo_root: string;
	project_files: string[];
	project_type_names: ReadonlySet<string>;
	context: LintProjectContextContract;
	ignored_files: ReadonlySet<string>;
	entry_files: readonly string[];
};

/** Responsibilities: _unused-symbol reference index_. **/
export interface UnusedSymbolReferenceIndexContract {
	prepare(): void;
	usage_present(definition: UnusedSymbolDefinition): boolean;
	add_source(source: LintSourceRecord): void;
}

/** Responsibilities: _unused symbol definition collection_. **/
export interface UnusedSymbolDefinitionCollectorContract {
	definitions(source: LintSourceRecord): UnusedSymbolDefinition[];
}
