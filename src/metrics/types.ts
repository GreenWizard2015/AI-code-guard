import type { LintFileNameContract } from "src/core/support/protocols";
import type {
	AstCallableNode,
	AstCallableReference,
	AstClassField,
	AstClassNode,
	AstReferenceAlias,
	AstTypeMemberRecord,
	AstTypedArgument,
	NormalizedAstFile,
} from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { SourceReferenceIndexContract } from "src/shared_services_protocols";
import type { SourceReference } from "src/source_types";
import type { CallableOwnershipResolver, RuleContextState } from "src/types";
export type ParsedFile = {
	file: string;
	absolute_file: string;
	imports: ReadonlySet<string>;
	ast: NormalizedAstFile;
	reference_aliases: readonly AstReferenceAlias[];
};
export type ParsedFilesByName = ReadonlyMap<string, ParsedFile>;
export type CallableDefinition = {
	file: string;
	kind: SharedCallableKind;
	node: AstCallableNode;
};

export type MethodNameSet = ReadonlySet<string>;
export type MethodNamesByOwner = ReadonlyMap<string, MethodNameSet>;
export type MethodOwnerReferences = Map<string, SourceReference[]>;
export type MethodReferencesByName = Map<string, MethodOwnerReferences>;
export type MethodReferencesByFile = Map<string, MethodReferencesByName>;
export type MethodOwnerReferenceView = ReadonlyMap<string, readonly SourceReference[]>;
export type MethodReferenceIndexView = ReadonlyMap<string, MethodOwnerReferenceView>;
export type OwnedReferences = AstCallableReference[];
export type OwnedReferencesByName = Map<string, OwnedReferences>;
export type OwnedReferencesByKind = Map<SharedCallableKind, OwnedReferencesByName>;

export type CallableMatcherIndexes = {
	classes: ReadonlyMap<string, AstClassNode>;
	protocol_names: ReadonlySet<string>;
	methods_by_owner: MethodNamesByOwner;
	method_owner_counts: ReadonlyMap<string, number>;
	files_by_name: ReadonlyMap<string, ParsedFile>;
	contract_method_files: ReadonlyMap<string, readonly ParsedFile[]>;
	method_owner_references: MethodReferenceIndexView;
};

export type CallableProjectIndex = ReadonlyMap<string, AstTypeMemberRecord>;
export type CallableClassIndex = ReadonlyMap<string, AstClassNode>;
export type CallableMethodCountsByName = Map<string, number>;
export type ClassStateEvidence = {
	readonly constructor_injected_state: boolean;
	readonly inherited_instance_state: boolean;
	readonly inherited_state_names: ReadonlySet<string>;
};

/** Responsibilities: _project class name groups_. **/
export type ClassStructureProjectNames = {
	project_class_names: ReadonlySet<string>;
	project_contract_names: ReadonlySet<string>;
	project_alias_names: ReadonlySet<string>;
};

export type ClassStructureReporterOptions = {
	stage_timer: LintStageTimerContract;
	violations: ViolationContract[];
	file_name: LintFileNameContract;
	node: AstClassNode;
	suppress_short_class: boolean;
	mutated_readonly_fields: ReadonlySet<string>;
	class_state: ClassStateEvidence;
	project_class_names: ReadonlySet<string>;
	project_contract_names: ReadonlySet<string>;
	project_alias_names: ReadonlySet<string>;
};
/** Responsibilities: _callable definition_, _local source record_, _method count_. **/
export type CallableDefinitionUsageSubject = {
	readonly definition: CallableDefinition;
	readonly local_file: ParsedFile;
	readonly method_count: number;
};

/** Responsibilities: _project source records_, _callable and type indexes_. **/
export type CallableDefinitionUsageProject = {
	readonly production_files: ParsedFile[];
	readonly production_file_index: ParsedFilesByName;
	readonly production_file_names: ReadonlySet<string>;
	readonly test_file_names: ReadonlySet<string>;
	readonly definitions: CallableDefinition[];
	readonly type_members: CallableProjectIndex;
	readonly class_nodes: CallableClassIndex;
	readonly matcher_indexes: CallableMatcherIndexes;
};

/** Responsibilities: _callable usage references_. **/
export type CallableDefinitionUsageReferences = {
	readonly reference_index: SourceReferenceIndexContract<string>;
	readonly references_by_file: CallableReferencesByFile;
};

/** Responsibilities: _callable definition usage analysis inputs_. **/
export type CallableDefinitionUsageInput = {
	readonly subject: CallableDefinitionUsageSubject;
	readonly project: CallableDefinitionUsageProject;
	readonly references: CallableDefinitionUsageReferences;
};

/** Responsibilities: _callable matcher definition identity_, _source language_. **/
export type CallableMatcherDefinitionContext = {
	readonly definition: CallableDefinition;
	readonly is_python: boolean;
};

/** Responsibilities: _callable matcher source files_, _production source lookup_. **/
export type CallableMatcherSourceContext = {
	readonly production_file_index: ParsedFilesByName;
};

/** Responsibilities: _callable matcher project type indexes_. **/
export type CallableMatcherProjectContext = {
	readonly definitions: CallableDefinition[];
	readonly project_types: CallableProjectIndex;
	readonly class_nodes: CallableClassIndex;
	readonly matcher_indexes: CallableMatcherIndexes;
};

/** Responsibilities: _callable matcher reference indexes_, _ownership resolution_. **/
export type CallableMatcherReferencesContext = {
	readonly reference_index: SourceReferenceIndexContract<string>;
	readonly references_by_file: CallableReferencesByFile;
	readonly ownership: CallableOwnershipResolver;
};

/** Responsibilities: _callable matcher input groups_. **/
export type CallableMatcherContext = {
	readonly callable: CallableMatcherDefinitionContext;
	readonly source: CallableMatcherSourceContext;
	readonly project: CallableMatcherProjectContext;
	readonly references: CallableMatcherReferencesContext;
};

export type SharedCallableKind = "function" | "method";
/** Responsibilities: _named reference access_, _owner reference lookup_. **/
export interface CallableReferencesByNameContract extends ReadonlyMap<string, readonly AstCallableReference[]> {
	owned_references(kind: SharedCallableKind, name: string): readonly AstCallableReference[];
}
export type CallableReferencesByFile = ReadonlyMap<string, CallableReferencesByNameContract>;
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
export type SharedParameterTypeSource = {
	readonly file: string;
	readonly name: string;
};
export type TypeSyntaxSegmentKind = "reference" | "literal" | "separator";
export type TypeSyntaxSegment = {
	readonly kind: TypeSyntaxSegmentKind;
	readonly value: string;
};
/** Responsibilities: _canonical type access_, _type reference access_. **/
export interface SharedParameterTypeIdentityContract {
	canonical(): string;
	reference_names(): string[];
	scoped_key(
		kind: SharedParameterKind,
		name: string,
		file: string,
		sources: ReadonlyMap<string, SharedParameterTypeSource>,
	): string;
}
/** Responsibilities: _directed pair support accumulation_, _support threshold lookup_. **/
export class SharedParameterPairCountMap extends Map<number, number> {
	/** Responsibilities: _support count increment_. **/
	public add_support(index: number): void {
		const support = this.get(index);
		if (support === undefined) {
			this.set(index, 1);
			return;
		}
		this.set(index, support + 1);
	}

	/** Responsibilities: _support threshold comparison_. **/
	public meets_threshold(index: number, threshold: number): boolean {
		const support = this.get(index);
		if (support === undefined) {
			return false;
		}
		return support >= threshold;
	}
}

export type SharedParameterPairCounts = Map<number, SharedParameterPairCountMap>;
export type SharedParameterLocationPostings = Map<string, number[]>;
/** Responsibilities: _shared parameter types_. **/
export interface SharedParameterTypeContract {
	identity(type: string): SharedParameterTypeIdentityContract;
	project_reference(type: string): boolean;
	parameter(argument: AstTypedArgument, uses: ReadonlyMap<string, number>): AnalyzedParameter[];
}
export type ProjectTypeBoundarySource = {
	violations: ViolationContract[];
	file: string;
	callables: readonly AstCallableNode[];
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

/** Responsibilities: _project boundary name resolution_. **/
export interface TypeScriptProjectBoundaryNamesContract {
	names(project_state: RuleContextState): ProjectTypeBoundaryNames;
}

export type ProjectTypeBoundaryInput = {
	source: ProjectTypeBoundarySource;
	names: ProjectTypeBoundaryNames;
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

/** Responsibilities: _shared parameter candidate branches_. **/
export interface SharedParameterCandidateExplorerContract {
	append_maximal_candidates(options: SharedParameterCandidateExploration): void;
	compare_nodes(left: SharedParameterNode, right: SharedParameterNode): number;
	compare_locations(left: CallableLocation, right: CallableLocation): number;
	compare_candidates(left: SharedParameterCandidate, right: SharedParameterCandidate): number;
	intersect_locations(left: readonly CallableLocation[], right: readonly CallableLocation[]): CallableLocation[];
}

/** Responsibilities: _shared parameter neighbor index_. **/
export interface SharedParameterNeighborIndexContract {
	prepare(nodes: readonly SharedParameterNode[]): void;
	for_root(root: number): readonly number[];
}

/** Responsibilities: _shared parameter type sources_. **/
export interface SharedParameterTypeSourcesContract {
	collect(): ReadonlyMap<string, SharedParameterTypeSource>;
}

/** Responsibilities: _shared parameter violation collection_. **/
export interface SharedParameterAdapterContract {
	violations(): ViolationContract[];
}

export type AnalyzedParameter = {
	readonly key: string;
	readonly identity: string;
	readonly type_identity: SharedParameterTypeIdentityContract;
	readonly kind: SharedParameterKind;
	readonly primitive: boolean;
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
	readonly primitive: boolean;
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
	readonly pending: Map<string, SharedParameterCandidateBranch>;
	readonly candidates: SharedParameterCandidate[];
	readonly candidate_indexes: readonly number[];
};
export type SharedParameterAnalysisInput = {
	readonly file: string;
	readonly kind: SharedCallableKind;
	readonly nodes: readonly AstCallableNode[];
	readonly type_sources: ReadonlyMap<string, SharedParameterTypeSource>;
	readonly project_types: ReadonlySet<string>;
	readonly reference_aliases: readonly AstReferenceAlias[];
	readonly language: SharedParameterLanguage;
};
export type MutableParameterNode = {
	readonly key: string;
	readonly identity: string;
	readonly kind: SharedParameterKind;
	readonly primitive: boolean;
	readonly project_type: boolean;
	readonly locations: Map<string, CallableLocation>;
};
