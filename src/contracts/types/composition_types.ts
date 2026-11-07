import type { CompositionChainFrameContract } from "src/contracts/protocols/composition_protocols";
import type {
	CallableClassIndex,
	CallableDefinition,
	CallableMatcherIndexes,
	CallableProjectIndex,
	CallableReferencesByFile,
	ParsedFile,
} from "src/metrics/types";
import type { AstClassNode } from "src/model/ast/normalized_ast_types";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { CodeClass, ImportedSymbol } from "src/model_types";
import type { CallableMethodCountsContract, SourceReferenceIndexContract } from "src/shared_services_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceScanContract } from "src/source_protocols";
import type { LintSourceRecordData, PythonProjectImportContext } from "src/source_types";
import type { CallableOwnershipResolver } from "src/types";
import type ts from "typescript";

/** Responsibilities: _callable usage analysis context_. **/
export type CallableUsageAnalysisOptions = {
	readonly project_root: string;
	readonly project_files: readonly string[];
	readonly import_context: PythonProjectImportContext;
	readonly project_source_scanner: ProjectSourceScanContract;
	readonly source_asts: ReadonlyMap<string, NormalizedAstFile>;
	readonly sources: readonly LintSourceRecordData[];
	readonly stage_timer: LintStageTimerContract;
};

export type ClassesByName = Map<string, CodeClass>;
export type ImportsByName = Map<string, ImportedSymbol>;
export type ClassesByFile = Map<string, ClassesByName>;
export type ImportsByFile = Map<string, ImportsByName>;
export type NamedClassNodes = ReadonlyMap<string, AstClassNode>;
export type ClassNodesByFile = ReadonlyMap<string, NamedClassNodes>;

/** Responsibilities: _callable usage collector state_. **/
export type CallableUsageCollectorState = {
	readonly production_files: ParsedFile[];
	readonly matcher_indexes: CallableMatcherIndexes;
	readonly definitions: CallableDefinition[];
	readonly method_counts: CallableMethodCountsContract;
	readonly external_methods: ReadonlySet<CallableDefinition>;
	readonly project_types: CallableProjectIndex;
	readonly class_nodes: CallableClassIndex;
	readonly reference_index: SourceReferenceIndexContract<string>;
	readonly references_by_file: CallableReferencesByFile;
	readonly ownership: CallableOwnershipResolver;
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

export type CompositionFrameContext = {
	active: Set<string>;
	frames: CompositionChainFrameContract[];
	depths: Map<string, number>;
	next_keys: Map<string, string>;
	contextual: Set<string>;
};

export type CompositionFrameStateData = {
	next_index: number;
	best_depth: number;
	best_next: string;
	cycle_dependent: boolean;
	waiting_for: string;
};

export type CompositionChainPathState = {
	current_key: string;
	done: boolean;
	names: string[];
	visited: Set<string>;
};

export type CompositionChainPathOptions = {
	classes: ReadonlyMap<string, CodeClass>;
	local_next_keys: ReadonlyMap<string, string>;
	memo_next_keys: ReadonlyMap<string, string>;
	root_key: string;
};

export type LocalImport = { clause: ts.ImportClause; file: string };
export type UsageData = { used_locally: boolean; external_files: Set<string> };
