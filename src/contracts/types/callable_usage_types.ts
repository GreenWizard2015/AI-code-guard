import type { CallableReferencesByNameContract, MethodReferenceIndexView, SharedCallableKind } from "src/metrics/types";
import type { CallableDefinition, ParsedFile } from "src/metrics/types";
import type {
	AstCallableNode,
	AstCallableReference,
	AstClassNode,
	AstReferenceAlias,
	AstTypeMemberRecord,
	NormalizedAstFile,
} from "src/model/ast/normalized_ast_types";
import type { SourceReferenceIndexContract } from "src/shared_services_protocols";

/** Responsibilities: _per-file reference groups_, _mutable file catalog_. **/
export interface CallableReferencesByFileContract extends Map<string, CallableReferencesByNameContract> {}

/** Responsibilities: _owner method names_, _mutable method catalog_. **/
export interface CallableOwnerMethodNamesContract extends Set<string> {}

/** Responsibilities: _type member records_, _type identity bucket_. **/
export interface TypeMemberCandidatesContract extends Set<AstTypeMemberRecord> {}

/** Responsibilities: _class node records_, _class identity bucket_. **/
export interface ClassNodeCandidatesContract extends Set<AstClassNode> {}

/** Responsibilities: _type identity groups_, _type member records_. **/
export interface TypeCandidatesContract extends Map<string, TypeMemberCandidatesContract> {}

/** Responsibilities: _class identity groups_, _class node records_. **/
export interface ClassCandidatesContract extends Map<string, ClassNodeCandidatesContract> {}

/** Responsibilities: _callable input file_, _AST data access_. **/
export type CallableUsageFile = {
	readonly file: string;
	readonly absolute_file: string;
	readonly imports: ReadonlySet<string>;
	readonly ast: NormalizedAstFile;
	readonly reference_aliases: readonly AstReferenceAlias[];
};

export type MethodFileIndexSnapshot = {
	readonly method_references: MethodReferenceIndexView;
	readonly protocol_names: ReadonlySet<string>;
	readonly files_by_name: ReadonlyMap<string, CallableUsageFile>;
};

/** Responsibilities: _callable source occurrence_, _source location identity_. **/
export type CallableUsageReferenceOccurrence = {
	readonly file_name: string;
	readonly reference: AstCallableReference;
};

/** Responsibilities: _definition identity_, _callable node_. **/
export type CallableUsageDefinition = {
	readonly file: string;
	readonly kind: SharedCallableKind;
	readonly node: AstCallableNode;
};

/** Responsibilities: _protocol method source files_. **/
export type CallableMethodFiles = ReadonlyMap<string, readonly ParsedFile[]>;

/** Responsibilities: _callable reference indexes_, _protocol method candidates_. **/
export type CallableUsageReferenceSnapshot = {
	readonly reference_index: SourceReferenceIndexContract<string>;
	readonly references_by_file: CallableReferencesByFileContract;
	readonly files_by_name: ReadonlyMap<string, CallableUsageFile>;
	readonly method_owner_references: MethodReferenceIndexView;
	readonly contract_method_files: CallableMethodFiles;
};

/** Responsibilities: _class lookup_, _protocol names_. **/
export type MatcherClassIndexes = {
	readonly classes: ReadonlyMap<string, AstClassNode>;
	readonly protocol_names: ReadonlySet<string>;
};

/** Responsibilities: _class candidates_, _owner methods_. **/
export type MatcherIndexes = {
	readonly classes: ReadonlyMap<string, AstClassNode>;
	readonly protocol_names: ReadonlySet<string>;
	readonly methods_by_owner: ReadonlyMap<string, CallableOwnerMethodNamesContract>;
	readonly method_owner_counts: ReadonlyMap<string, number>;
	readonly files_by_name: ReadonlyMap<string, ParsedFile>;
	readonly contract_method_files: ReadonlyMap<string, readonly ParsedFile[]>;
	readonly method_owner_references: MethodReferenceIndexView;
};

/** Responsibilities: _declaration indexes_, _reference indexes_. **/
export type CallableUsageIndexState = {
	readonly project_types: ReadonlyMap<string, AstTypeMemberRecord>;
	readonly class_nodes: ReadonlyMap<string, AstClassNode>;
	readonly matcher_indexes: MatcherIndexes;
	readonly reference_index: SourceReferenceIndexContract<string>;
	readonly references_by_file: CallableReferencesByFileContract;
};

/** Responsibilities: _owner method names_, _definition counts_. **/
export type MethodOwnerIndexes = {
	readonly methods_by_owner: Map<string, CallableOwnerMethodNamesContract>;
	readonly method_owner_counts: Map<string, number>;
};

/** Responsibilities: _source class names_, _file class membership_. **/
export type CallableClassNameSet = ReadonlySet<string>;
export type CallableClassNamesByFile = ReadonlyMap<string, CallableClassNameSet>;

/** Responsibilities: _source reference aliases_. **/
export type CallableReferenceAliases = AstReferenceAlias[];

/** Responsibilities: _project callable definition collection_, _external base classification_. **/
export interface CallableSourceProjectAnalysisContract {
	mark_external_bases(): ParsedFile[];
	callable_definitions(): CallableDefinition[];
}
