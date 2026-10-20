import type { IOContract } from "src/io/protocols";
import type { LintSourceRecord } from "src/source_types";
import type ts from "typescript";
import type { StringSet, StringStringMap, StringSetMap, ReadonlyStringSet, AbsoluteImportRootIndex } from "src/analysis_types";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type {
	AstCallableNodeContract,
	AstClassNode,
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

export type AstCacheAstStructure = {
	language: AstLanguage;
	classes: AstClassNode[];
	functions: AstCallableNodeContract[];
	parse_issues: AstParseIssue[];
	import_issues: AstImportIssue[];
	attribute_accesses: LineDepth[];
	named_symbols: NamedSymbol[];
	type_declarations: NamedLine[];
};
export type AstCacheAstReferences = {
	symbol_references: NamedLine[];
	literal_references: AstLiteralReference[];
	literal_constants: AstLiteralConstant[];
	reference_aliases: AstReferenceAlias[];
	private_accesses: LineOnly[];
	repeated_branches: LineOnly[];
	call_references: AstCallableReference[];
	module_instances: AstModuleInstance[];
};
export type AstCacheAstModuleMetadata = {
	module_constant_spans: AstSourceSpan[];
	module_type_spans: AstSourceSpan[];
	module_protocol_spans: AstSourceSpan[];
	type_members: AstTypeMembersSerialized;
	coding_issues: AstCodingIssue[];
	responsibility_targets: AstResponsibilityTarget[];
};
export type AstCacheAstPythonMetadata = {
	python_imports: AstPythonImport[];
	python_callable_count: FunctionCount;
	python_main_guard: boolean;
	docstring_spans: AstSourceSpan[];
};
export type AstCacheAst = AstCacheAstStructure &
	AstCacheAstReferences &
	AstCacheAstModuleMetadata &
	AstCacheAstPythonMetadata;

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
