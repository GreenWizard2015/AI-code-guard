import type {
	UnusedFieldOwnershipIndexContract,
	UnusedSymbolReceiverContract,
} from "src/contracts/protocols/lint_runtime_protocols";
import type { UnusedDefinitionMatches, UnusedSymbolDefinition } from "src/core/types";
import type { UnusedFieldOwner } from "src/core/types";
import type { UnusedSourceImportCache } from "src/core/types";
import type { AstPythonImportName } from "src/model/ast/normalized_ast_types";
import type { ProjectSourceScanContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type ts from "typescript";

/** Responsibilities: _source ownership analysis options_. **/
export type UnusedSymbolSourceOwnershipOptions = {
	source: LintSourceRecordData;
	scanner: ProjectSourceScanContract;
	available_files: Set<string>;
	import_cache: UnusedSourceImportCache;
	receiver: UnusedSymbolReceiverContract;
	fields: UnusedFieldOwnershipIndexContract;
};

/** Responsibilities: _unused-symbol reference index_. **/
export interface UnusedSymbolReferenceIndexContract {
	usage_present(definition: UnusedSymbolDefinition): boolean;
	add_external_usage(file: string, name: string): void;
	add_source(source: LintSourceRecordData): void;
}

/** Responsibilities: _unused field ownership lookup_. **/
export interface UnusedSymbolPropertyOwnershipContract {
	property_usage_owners(
		source: LintSourceRecordData,
		receiver: ts.Expression,
		name: string,
	): readonly UnusedFieldOwner[];
	contract_fields(definition: UnusedSymbolDefinition): readonly UnusedFieldOwner[];
}

export type UnusedSymbolPropertyAccess = {
	source: LintSourceRecordData;
	access: ts.PropertyAccessExpression;
};
export type UnusedSymbolElementAccess = {
	source: LintSourceRecordData;
	access: ts.ElementAccessExpression;
};

/** Responsibilities: _unused symbol definition collection_. **/
export interface UnusedSymbolDefinitionCollectorContract {
	definitions(): UnusedSymbolDefinition[];
}

/** Responsibilities: _reference alias registration_, _reference name expansion_. **/
export interface UnusedSymbolAliasIndexContract {
	add_source(source: LintSourceRecordData): void;
	names(source: LintSourceRecordData, name: string): string[];
}

/** Responsibilities: _Python imported-symbol path traversal_. **/
export interface PythonReexportTraversalContract {
	symbol_name(): string;
	source(): LintSourceRecordData;
	fork(name: string, source: LintSourceRecordData): PythonReexportTraversalContract;
	enter(): boolean;
	unique_definitions(definitions: UnusedDefinitionMatches): UnusedDefinitionMatches;
}

/** Responsibilities: _per-file symbol name lookup_. **/
export interface UnusedSymbolFileNameBucketsContract {
	all(): UnusedDefinitionMatches;
	named(names: readonly string[]): UnusedDefinitionMatches;
	exact(name: string): UnusedDefinitionMatches;
}

/** Responsibilities: _Python source definition lookup_. **/
export interface UnusedSymbolDefinitionLookupContract {
	for_file(file: string): UnusedSymbolFileNameBucketsContract;
}

/** Responsibilities: _Python re-export graph configuration_. **/
export type PythonReexportGraphOptions = {
	scanner: ProjectSourceScanContract;
	available_files: Set<string>;
	alias_index: UnusedSymbolAliasIndexContract;
	definitions: UnusedSymbolDefinitionLookupContract;
	sources_by_path: ReadonlyMap<string, LintSourceRecordData>;
	exports_by_file: ReadonlyMap<string, PythonExportNames>;
};

/** Responsibilities: _Python re-export graph operations_. **/
export interface PythonReexportGraphContract {
	exports_name(file: string, name: string): boolean;
	resolve(traversal: PythonReexportTraversalContract): UnusedDefinitionMatches;
}

export type PythonExportNames = ReadonlySet<string>;

export type PythonExportNamesByFile = Map<string, PythonExportNames>;

export type PythonReexportEdge = {
	source: LintSourceRecordData;
	target: LintSourceRecordData;
	imported: AstPythonImportName;
	traversal: PythonReexportTraversalContract;
};

/** Responsibilities: _TypeScript re-export target identity_. **/
export type TypeScriptReexportTarget = {
	readonly source: LintSourceRecordData;
	readonly name: string;
};

/** Responsibilities: _TypeScript re-export traversal state_. **/
export type TypeScriptReexportTraversal = {
	pending: TypeScriptReexportTarget[];
	visited: Set<string>;
	found: Map<string, UnusedSymbolDefinition>;
};
