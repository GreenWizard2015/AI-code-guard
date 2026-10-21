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
	AstClassNodeContract,
	CallableOwnershipResolver,
	CodeClass,
	ImportedSymbol,
} from "src/types";
import type { CallableMethodCountsContract, SourceReferenceIndexContract } from "src/shared_services_protocols";

export type ClassesByName = Map<string, CodeClass>;
export type ImportsByName = Map<string, ImportedSymbol>;
export type ClassesByFile = Map<string, ClassesByName>;
export type ImportsByFile = Map<string, ImportsByName>;
export type NamedClassNodes = ReadonlyMap<string, AstClassNodeContract>;
export type ClassNodesByFile = ReadonlyMap<string, NamedClassNodes>;

/** Responsibilities: _callable usage source files_. **/
interface CallableUsageFilesContract {
	readonly parsed_files: ParsedFile[];
	readonly production_files: ParsedFile[];
	readonly test_files: ParsedFile[];
	readonly matcher_indexes: CallableMatcherIndexes;
};
/** Responsibilities: _callable usage definitions_. **/
interface CallableUsageDefinitionsContract {
	readonly definitions: CallableDefinition[];
	readonly method_counts: CallableMethodCountsContract;
	readonly external_methods: ReadonlySet<CallableDefinition>;
};
/** Responsibilities: _callable usage indexes_. **/
interface CallableUsageIndexesContract {
	readonly project_types: CallableProjectIndex;
	readonly class_nodes: CallableClassIndex;
	readonly reference_index: SourceReferenceIndexContract<string>;
	readonly references_by_file: CallableReferencesByFile;
	readonly ownership: CallableOwnershipResolver;
};
/** Responsibilities: _callable usage collector state_. **/
export interface CallableUsageCollectorStateContract
	extends CallableUsageFilesContract, CallableUsageDefinitionsContract, CallableUsageIndexesContract {}


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
