import type {
	CallableReferenceKindTag,
	ReadonlyStringMap,
	ReadonlyStringSet,
	StringBooleanMap,
} from "src/analysis_types";
import type { LintFileNameContract } from "src/core/support/protocols";
import type { AstLanguage, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type {
	AstCallableUse,
	AstImportIssue,
	AstLiteralConstant,
	AstLiteralReference,
	LineDepth,
	NamedLine,
	NamedSymbol,
} from "src/model/ast/normalized_ast_types";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract, ProjectSourcePythonContract } from "src/source_protocols";
import type { TypeScriptAstFileContract, TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type ts from "typescript";

export type PythonProjectImportContext = {
	root: string;
	files: ReadonlySet<string>;
	resolver: ProjectSourcePythonContract;
};

/** Responsibilities: _immutable source record data_. **/
export type LintSourceRecordData = {
	readonly absolute_path: string;
	readonly relative_path: string;
	readonly file_name: LintFileNameContract;
	readonly text: string;
	readonly normalized_ast: NormalizedAstFile;
	readonly language: AstLanguage;
	readonly typescript_ast: TypeScriptAstFileContract;
	readonly source_resolver: SourceFileResolver;
	readonly traversal: TypeScriptAstTraversalContract;
};
export type PendingUnusedSymbolReference = { source: LintSourceRecordData; name: string; line: number };
export type TypeScriptAstCreation = {
	ast_file: TypeScriptAstFileContract;
	traversal: TypeScriptAstTraversalContract;
};
export type ContextSourceRecordOptions = {
	repo_root: string;
	file: string;
	text: string;
	source_files: ReadonlyMap<string, ts.SourceFile>;
	python_file_asts: ReadonlyMap<string, NormalizedAstFile>;
	typescript_asts: ReadonlyMap<string, NormalizedAstFile>;
	stage_timer: LintStageTimerContract;
	source_io: ProjectSourceIOContract;
};
export type TypeScriptAstCreationOptions = {
	file: string;
	text: string;
	source_files: ReadonlyMap<string, ts.SourceFile>;
	project_root: string;
	stage_timer: LintStageTimerContract;
	source_io: ProjectSourceIOContract;
};
export type ContextSourceRecordsOptions = {
	repo_root: string;
	project_files: string[];
	files: string[];
	texts: ReadonlyMap<string, string>;
	source_files: ReadonlyMap<string, ts.SourceFile>;
	python_file_asts: ReadonlyMap<string, NormalizedAstFile>;
	stage_timer: LintStageTimerContract;
	virtual_project: boolean;
	source_io: ProjectSourceIOContract;
};
export type ContextSourceRecordCacheOptions = {
	repo_root: string;
	project_files: string[];
	files: string[];
	texts: ReadonlyMap<string, string>;
	virtual_project: boolean;
	source_io: ProjectSourceIOContract;
};
export type TypeScriptTreeMetadata = {
	attribute_accesses: LineDepth[];
	symbol_references: NamedLine[];
	literal_references: AstLiteralReference[];
	literal_constants: AstLiteralConstant[];
	import_issues: AstImportIssue[];
	named_symbols: NamedSymbol[];
	type_declarations: NamedLine[];
};
export type AbsoluteImportCandidate = { file: string };

export type SourceReference = { file: string; line: number };
export type SourceReferenceRelation = "implementation" | "usage";
export type SourceReferenceMap<TKey extends {}> = Map<TKey, SourceReference[]>;

export type SourceFileResolver = ReadonlyMap<string, ts.SourceFile>;

export type SourceFileDeclarationMap = Map<string, ts.Declaration>;

export type SourceFileDeclarationCache = WeakMap<ts.SourceFile, SourceFileDeclarationMap>;

export type SourceFileStringSetCache = WeakMap<ts.SourceFile, ReadonlyStringSet>;

export type SourceFileCallableList = readonly ts.FunctionLikeDeclaration[];

export type SourceFileCallableMap = ReadonlyMap<string, SourceFileCallableList>;

export type SourceFileCallableCache = WeakMap<ts.SourceFile, SourceFileCallableMap>;

export type SourceFileReadonlyStringMapCache = WeakMap<ts.SourceFile, ReadonlyStringMap>;

export type SourceFileBooleanMapCache = WeakMap<ts.SourceFile, StringBooleanMap>;

export type AstCallableReferenceRecord = {
	name: string;
	kind: CallableReferenceKindTag;
	target_file: string;
	owner: string;
	caller_owner: string;
	is_call: boolean;
	dynamic: boolean;
	line: number;
	call_use: AstCallableUse;
};

export type CodingRuleSourceOptions = { file: string; text: string };

export type CodingRuleSourceData = {
	file: string;
	text: string;
	normalized_ast: NormalizedAstFile;
	source_file: ts.SourceFile;
	source_resolver: SourceFileResolver;
	traversal: TypeScriptAstTraversalContract;
};
