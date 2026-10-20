import type {
	AstArgumentUse,
	AstCallableNodeContract,
	AstCallableReference,
	AstClassNode,
	AstClassField,
	AstReferenceAlias,
	AstTypedArgument,
	AstVisibility,
	AstTypeMemberRecord,
	CallableOwnershipResolver,
	NormalizedAstFile,
} from "src/types";
import type { SourceReferenceIndexContract } from "src/shared_services_protocols";
import type { ViolationContract } from "src/reporting_protocols";
export type ParsedFile = {
	file: string;
	absolute_file: string;
	imports: ReadonlySet<string>;
	ast: NormalizedAstFile;
};
export type CallableDefinition = {
	file: string;
	kind: SharedCallableKind;
	node: AstCallableNodeContract;
};

export type CallableMatcherClassIndexes = {
	classes: Map<string, AstClassNode>;
	protocol_names: Set<string>;
};

export type CallableMatcherOwnerIndexes = {
	methods_by_owner: CallableMatcherNamesByOwner;
	method_owner_counts: Map<string, number>;
};

export type CallableMatcherIndexes = {
	classes: ReadonlyMap<string, AstClassNode>;
	protocol_names: ReadonlySet<string>;
	methods_by_owner: ReadonlyCallableMatcherNamesByOwner;
	method_owner_counts: ReadonlyMap<string, number>;
	files_by_name: ReadonlyMap<string, ParsedFile>;
};

export type CallableProjectIndex = Map<string, AstTypeMemberRecord>;
export type CallableClassIndex = Map<string, AstClassNode>;
export type CallableTypeCandidateSet = Set<AstTypeMemberRecord>;
export type CallableClassCandidateSet = Set<AstClassNode>;
export type CallableTypeCandidates = Map<string, CallableTypeCandidateSet>;
export type CallableClassCandidates = Map<string, CallableClassCandidateSet>;
export type CallableMetricNode = {
	name: string;
	start: number;
	end: number;
	argument_count: number;
	lines: number;
	sloc: number;
	characters: number;
	control_flow_depth: number;
	exception_only: boolean;
	visibility: AstVisibility;
};
export type SharedParameterNodeInput = {
	name: string;
	start: number;
	end: number;
	argument_count: number;
	owner: string;
	has_self: boolean;
	argument_uses: AstArgumentUse[];
	typed_arguments: AstTypedArgument[];
	visibility: AstVisibility;
};
/** Responsibilities: _callable definition_, _local source record_, _method count_. **/
export interface CallableDefinitionUsageSubjectContract {
	readonly definition: CallableDefinition;
	readonly local_file: ParsedFile;
	readonly method_count: number;
}

/** Responsibilities: _project source records_, _callable and type indexes_. **/
export interface CallableDefinitionUsageProjectContract {
	readonly production_files: ParsedFile[];
	readonly production_file_names: ReadonlySet<string>;
	readonly test_file_names: ReadonlySet<string>;
	readonly definitions: CallableDefinition[];
	readonly type_members: CallableProjectIndex;
	readonly class_nodes: CallableClassIndex;
	readonly matcher_indexes: CallableMatcherIndexes;
}

/** Responsibilities: _callable usage references_. **/
export interface CallableDefinitionUsageReferencesContract {
	readonly reference_index: SourceReferenceIndexContract<string>;
	readonly references_by_file: CallableReferencesByFile;
}

/** Responsibilities: _callable usage analysis inputs_. **/
export interface CallableDefinitionUsageInputContract
	extends CallableDefinitionUsageSubjectContract,
		CallableDefinitionUsageProjectContract,
		CallableDefinitionUsageReferencesContract {}

export type CallableMatcherNames = Set<string>;
export type CallableMatcherNamesByOwner = Map<string, CallableMatcherNames>;
export type ReadonlyCallableMatcherNames = ReadonlySet<string>;
export type ReadonlyCallableMatcherNamesByOwner = ReadonlyMap<string, ReadonlyCallableMatcherNames>;

export type CallableMatcherContext = {
	definition: CallableDefinition;
	is_python: boolean;
	parsed_files: ParsedFile[];
	definitions: CallableDefinition[];
	project_types: CallableProjectIndex;
	class_nodes: CallableClassIndex;
	reference_index: SourceReferenceIndexContract<string>;
	references_by_file: CallableReferencesByFile;
	ownership: CallableOwnershipResolver;
	matcher_indexes: CallableMatcherIndexes;
};

export type SharedCallableKind = "function" | "method";
export type CallableReferencesByName = ReadonlyMap<string, readonly AstCallableReference[]>;
export type CallableReferencesByFile = ReadonlyMap<string, CallableReferencesByName>;
export type MutableCallableReferencesByName = Map<string, AstCallableReference[]>;
export type MutableCallableReferencesByFile = Map<string, MutableCallableReferencesByName>;
export type SharedParameterKind = "basic" | "reference";
export type ParameterKindResult = { supported: boolean; value: SharedParameterKind };
export type SharedParameterLanguage = "python" | "typescript" | "unknown";
/** Responsibilities: _string name membership lookup_. **/
export interface StringNameMembershipContract {
	present(name: string): boolean;
}
/** Responsibilities: _project type membership_, _project type count_. **/
export interface ProjectTypeNameMembershipContract {
	count(): number;
	contains(name: string): boolean;
}
export type SharedParameterToolingCategory = "builtin" | "namespace" | "custom";
export type SharedParameterTypeSource = {
	readonly file: string;
	readonly name: string;
};
export type SharedParameterPairCountMap = Map<number, number>;
export type SharedParameterPairCounts = Map<number, SharedParameterPairCountMap>;
export type SharedParameterLocationPostings = Map<string, number[]>;
/** Responsibilities: _shared parameter types_. **/
export interface SharedParameterTypeContract {
	canonical(type: string): string;
	project_reference(type: string): boolean;
	parameter(argument: AstTypedArgument, uses: ReadonlyMap<string, number>): AnalyzedParameter[];
}
export type ProjectTypeBoundarySource = {
	violations: ViolationContract[];
	file: string;
	callables: readonly AstCallableNodeContract[];
	fields: readonly AstClassField[];
};

export type ProjectTypeBoundaryNames = {
	project_types: ReadonlySet<string>;
	project_class_names: ReadonlySet<string>;
	allowed_contracts: ReadonlySet<string>;
	forbidden_project_types: ReadonlySet<string>;
	imported_contract_names: ReadonlySet<string>;
	reference_aliases: readonly AstReferenceAlias[];
	language: SharedParameterLanguage;
};

export type ProjectTypeBoundaryInput = {
	source: ProjectTypeBoundarySource;
	names: ProjectTypeBoundaryNames;
};

export type ProjectTypeBoundaryState = {
	allowed_types: StringNameMembershipContract;
	type_classifier: SharedProjectTypeClassifierContract;
};

/** Responsibilities: _project type classification_. **/
export interface SharedProjectTypeClassifierContract {
	project_reference(type: string): boolean;
}

export type CallableLocation = {
	readonly file: string;
	readonly line: number;
	readonly method: string;
};

/** Responsibilities: _shared parameter location ordering_. **/
export interface SharedParameterOrderContract {
	compare_nodes(left: SharedParameterNode, right: SharedParameterNode): number;
	compare_locations(left: CallableLocation, right: CallableLocation): number;
	intersect_locations(left: readonly CallableLocation[], right: readonly CallableLocation[]): CallableLocation[];
}

/** Responsibilities: _shared parameter candidate branches_. **/
export interface SharedParameterCandidateExplorerContract {
	append_maximal_candidates(options: SharedParameterCandidateExploration): void;
}

/** Responsibilities: _shared parameter neighbor index_. **/
export interface SharedParameterNeighborIndexContract {
	with_nodes(nodes: readonly SharedParameterNode[]): SharedParameterNeighborIndexContract;
	for_root(root: number): readonly number[];
}

/** Responsibilities: _shared parameter type sources_. **/
export interface SharedParameterTypeSourcesContract {
	collect(): ReadonlyMap<string, SharedParameterTypeSource>;
}

export type AnalyzedParameter = {
	readonly key: string;
	readonly identity: string;
	readonly kind: SharedParameterKind;
	readonly project_type: boolean;
	readonly uses: number;
};

export type AnalyzedCallable = {
	readonly kind: SharedCallableKind;
	readonly language: SharedParameterLanguage;
	readonly location: CallableLocation;
	readonly parameters: readonly AnalyzedParameter[];
};

export type SharedParameterNode = {
	readonly key: string;
	readonly identity: string;
	readonly kind: SharedParameterKind;
	readonly project_type: boolean;
	readonly locations: readonly CallableLocation[];
};

export type SharedParameterCandidate = {
	readonly kind: SharedCallableKind;
	readonly nodes: readonly SharedParameterNode[];
	readonly locations: readonly CallableLocation[];
	readonly support: number;
};

export type SharedParameterCandidateBranch = {
	readonly next_index: number;
	readonly nodes: readonly SharedParameterNode[];
	readonly locations: readonly CallableLocation[];
};

export type CandidateExtension = {
	readonly branch: SharedParameterCandidateBranch;
	readonly node: SharedParameterNode;
	readonly index: number;
	readonly order: SharedParameterOrderContract;
	readonly pending: Map<string, SharedParameterCandidateBranch>;
};

export type SharedParameterCandidateExploration = {
	readonly nodes: readonly SharedParameterNode[];
	readonly next_index: number;
	readonly selected: readonly SharedParameterNode[];
	readonly locations: readonly CallableLocation[];
	readonly candidates: SharedParameterCandidate[];
	readonly candidate_indexes: readonly number[];
};

export type SharedParameterCandidateBranchOptions = {
	readonly branch: SharedParameterCandidateBranch;
	readonly nodes: readonly SharedParameterNode[];
	readonly order: SharedParameterOrderContract;
	readonly pending: Map<string, SharedParameterCandidateBranch>;
	readonly candidates: SharedParameterCandidate[];
	readonly candidate_indexes: readonly number[];
};
export type SharedParameterAnalysisInput = {
	readonly file: string;
	readonly kind: SharedCallableKind;
	readonly nodes: readonly SharedParameterNodeInput[];
	readonly type_sources: ReadonlyMap<string, SharedParameterTypeSource>;
	readonly project_types: ReadonlySet<string>;
	readonly reference_aliases: readonly AstReferenceAlias[];
	readonly language: SharedParameterLanguage;
};
export type MutableParameterNode = {
	readonly key: string;
	readonly identity: string;
	readonly kind: SharedParameterKind;
	readonly project_type: boolean;
	readonly locations: Map<string, CallableLocation>;
};
