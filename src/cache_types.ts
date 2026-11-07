import type { ReadonlyStringSet, StringSet, StringSetMap, StringStringMap } from "src/analysis_types";
import type { IOContract } from "src/io/protocols";
import type {
	AstCallableReference,
	AstLiteralConstant,
	AstLiteralReference,
	AstReferenceAlias,
	AstResponsibilityTarget,
	AstSourceSpan,
	AstTypeMembersSerialized,
	FunctionCount,
	LineDepth,
	NamedLine,
	NamedSymbol,
	NormalizedAstControlFlow,
	NormalizedAstSource,
} from "src/model/ast/normalized_ast_types";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type ts from "typescript";

/** Responsibilities: _cache AST references contract_. **/
export type AstCacheAstReferences = {
	readonly attribute_accesses: LineDepth[];
	readonly named_symbols: NamedSymbol[];
	readonly type_declarations: NamedLine[];
	readonly symbol_references: NamedLine[];
	readonly literal_references: AstLiteralReference[];
	readonly literal_constants: AstLiteralConstant[];
	readonly reference_aliases: AstReferenceAlias[];
	readonly call_references: AstCallableReference[];
	readonly type_members: AstTypeMembersSerialized;
};
/** Responsibilities: _cache module metadata contract_. **/
export type AstCacheAstModuleMetadata = {
	readonly module_constant_spans: AstSourceSpan[];
	readonly module_type_spans: AstSourceSpan[];
	readonly module_protocol_spans: AstSourceSpan[];
	readonly responsibility_targets: AstResponsibilityTarget[];
	readonly python_exports: string[];
	readonly python_callable_count: FunctionCount;
	readonly python_main_guard: boolean;
	readonly docstring_spans: AstSourceSpan[];
};
/** Responsibilities: _AST cache record_. **/
export type AstCacheAst = {
	readonly source: NormalizedAstSource;
	readonly references: AstCacheAstReferences;
	readonly control_flow: NormalizedAstControlFlow;
	readonly module_declarations: AstCacheAstModuleMetadata;
};

export type StringSetToStringMapCache = WeakMap<StringSet, StringStringMap>;

export type NodeStringSetMapCache = WeakMap<ts.Node, StringSetMap>;

export type NodeReadonlyStringSetCache = WeakMap<ts.Node, ReadonlyStringSet>;

export type GlobalAnalysisCacheOptions = {
	repo_root: string;
	records: readonly LintSourceRecordData[];
	files: ReadonlySet<string>;
	ignored_files: ReadonlySet<string>;
	entry_files: readonly string[];
	identity: ProjectAnalysisIdentityContract;
	context_identity: string;
	file_io: IOContract;
	source_io: ProjectSourceIOContract;
	temporary_write_paths: Set<string>;
};

export type FileAnalysisCacheOptions = {
	repo_root: string;
	analysis_identity: ProjectAnalysisIdentityContract;
	context_identity: string;
	file_io: IOContract;
	source_io: ProjectSourceIOContract;
};
