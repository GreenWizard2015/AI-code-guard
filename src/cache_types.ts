import type { IOContract } from "src/io/protocols";
import type { LintSourceRecord } from "src/source_types";
import type ts from "typescript";
import type {
	StringSet,
	StringStringMap,
	StringSetMap,
	ReadonlyStringSet,
	AbsoluteImportRootIndex,
} from "src/analysis_types";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type {
	AstCallableNodeContract,
	AstClassNodeContract,
	AstCodingIssue,
	AstImportIssue,
	AstLanguage,
	AstLiteralConstant,
	AstLiteralReference,
	AstModuleInstance,
	AstParseIssue,
	AstPythonImport,
	AstCallableReference,
	AstReferenceAlias,
	AstResponsibilityTarget,
	AstSourceSpan,
	AstTypeMembersSerialized,
	FunctionCount,
	LineDepth,
	LineOnly,
	NamedLine,
	NamedSymbol,
} from "src/types";

/** Responsibilities: _cache AST structure contract_. **/
export interface AstCacheAstStructureContract {
	readonly language: AstLanguage;
	readonly classes: AstClassNodeContract[];
	readonly functions: AstCallableNodeContract[];
	readonly parse_issues: AstParseIssue[];
	readonly import_issues: AstImportIssue[];
	readonly attribute_accesses: LineDepth[];
	readonly named_symbols: NamedSymbol[];
	readonly type_declarations: NamedLine[];
}
/** Responsibilities: _cache AST references contract_. **/
export interface AstCacheAstReferencesContract {
	readonly symbol_references: NamedLine[];
	readonly literal_references: AstLiteralReference[];
	readonly literal_constants: AstLiteralConstant[];
	readonly reference_aliases: AstReferenceAlias[];
	readonly private_accesses: LineOnly[];
	readonly repeated_branches: LineOnly[];
	readonly call_references: AstCallableReference[];
	readonly module_instances: AstModuleInstance[];
}
/** Responsibilities: _cache module metadata contract_. **/
export interface AstCacheAstModuleMetadataContract {
	readonly module_constant_spans: AstSourceSpan[];
	readonly module_type_spans: AstSourceSpan[];
	readonly module_protocol_spans: AstSourceSpan[];
	readonly type_members: AstTypeMembersSerialized;
	readonly coding_issues: AstCodingIssue[];
	readonly responsibility_targets: AstResponsibilityTarget[];
}
/** Responsibilities: _cache Python metadata contract_. **/
export interface AstCacheAstPythonMetadataContract {
	readonly python_imports: AstPythonImport[];
	readonly python_exports: string[];
	readonly python_callable_count: FunctionCount;
	readonly python_main_guard: boolean;
	readonly docstring_spans: AstSourceSpan[];
}
/** Responsibilities: _AST cache record_. **/
export interface AstCacheAstContract
	extends AstCacheAstStructureContract,
		AstCacheAstReferencesContract,
		AstCacheAstModuleMetadataContract,
		AstCacheAstPythonMetadataContract {}

export type StringSetToStringMapCache = WeakMap<StringSet, StringStringMap>;

export type NodeStringSetMapCache = WeakMap<ts.Node, StringSetMap>;

export type NodeReadonlyStringSetCache = WeakMap<ts.Node, ReadonlyStringSet>;

export type AbsoluteImportRootCache = WeakMap<ReadonlyStringSet, AbsoluteImportRootIndex>;

export type GlobalAnalysisCacheOptions = {
	repo_root: string;
	records: readonly LintSourceRecord[];
	files: ReadonlySet<string>;
	ignored_files: ReadonlySet<string>;
	entry_files: readonly string[];
	identity: ProjectAnalysisIdentityContract;
	file_io: IOContract;
	source_io: ProjectSourceIOContract;
};
