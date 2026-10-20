import ts from "typescript";
import type {
	CallableClassIndex,
	CallableDefinition,
	CallableMatcherIndexes,
	CallableProjectIndex,
	CallableReferencesByFile,
	ParsedFile,
} from "src/metrics/types";
import type {
	AstClassNode,
	CallableOwnershipResolver,
	CodeClass,
	ImportedSymbol,
} from "src/types";
import type { CallableMethodCountsContract, SourceReferenceIndexContract } from "src/shared_services_protocols";

export type ClassesByName = Map<string, CodeClass>;
export type ImportsByName = Map<string, ImportedSymbol>;
export type ClassesByFile = Map<string, ClassesByName>;
export type ImportsByFile = Map<string, ImportsByName>;
export type NamedClassNodes = ReadonlyMap<string, AstClassNode>;
export type ClassNodesByFile = ReadonlyMap<string, NamedClassNodes>;

type CallableUsageFiles = {
	parsed_files: ParsedFile[];
	production_files: ParsedFile[];
	test_files: ParsedFile[];
	matcher_indexes: CallableMatcherIndexes;
};
type CallableUsageDefinitions = {
	definitions: CallableDefinition[];
	method_counts: CallableMethodCountsContract;
	external_methods: ReadonlySet<CallableDefinition>;
};
type CallableUsageIndexes = {
	project_types: CallableProjectIndex;
	class_nodes: CallableClassIndex;
	reference_index: SourceReferenceIndexContract<string>;
	references_by_file: CallableReferencesByFile;
	ownership: CallableOwnershipResolver;
};
export type CallableUsageCollectorState = CallableUsageFiles & CallableUsageDefinitions & CallableUsageIndexes;

export type CallableUsageIndexState = {
	project_types: CallableProjectIndex;
	class_nodes: CallableClassIndex;
	matcher_indexes: CallableMatcherIndexes;
	reference_index: SourceReferenceIndexContract<string>;
	references_by_file: CallableReferencesByFile;
};

export type CallableUsageAnalysisState = {
	project_types: CallableProjectIndex;
	class_nodes: CallableClassIndex;
	matcher_indexes: CallableMatcherIndexes;
	reference_index: SourceReferenceIndexContract<string>;
	references_by_file: CallableReferencesByFile;
	external_methods: ReadonlySet<CallableDefinition>;
	ownership: CallableOwnershipResolver;
};

export type CallableOwnershipIndexes = {
	by_file: ReadonlyMap<string, ParsedFile>;
	by_absolute_file: ReadonlyMap<string, ParsedFile>;
	classes_by_file: ClassNodesByFile;
};

export type CompositionTraversalState = {
	key: string;
	expanded: boolean;
};

export type LocalImport = { clause: ts.ImportClause; file: string };
export type UsageData = { used_locally: boolean; external_files: Set<string> };
