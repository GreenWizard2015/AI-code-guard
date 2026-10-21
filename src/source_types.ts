import type ts from "typescript";
import type { NormalizedAstFileContract } from "src/types";
import type { ReadonlyStringSet, ReadonlyStringMap, StringBooleanMap, CallableReferenceKindContract } from "src/analysis_types";
import type { TypeScriptAstFileContract, TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type {
	AstImportIssue,
	AstLanguage,
	AstLiteralConstant,
	AstLiteralReference,
	LineDepth,
	NamedLine,
	NamedSymbol,
} from "src/types";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract, ProjectSourcePythonContract } from "src/source_protocols";

export type PythonProjectImportContext = {
	root: string;
	files: ReadonlySet<string>;
	resolver: ProjectSourcePythonContract;
};

export type FileNameLike = { value: string };
export type LintFileNameContract = {
	value: string;
	is_functions_file: boolean;
	test(): boolean;
	product(): boolean;
};
export type LintSourceRecord = {
	absolute_path: string;
	relative_path: string;
	file_name: LintFileNameContract;
	text: string;
	normalized_ast: NormalizedAstFileContract;
	language: AstLanguage;
	typescript_ast: TypeScriptAstFileContract;
	source_resolver: SourceFileResolver;
	traversal: TypeScriptAstTraversalContract;
	typescript(): boolean;
	python(): boolean;
};
export type LintSourceRecordOptions = {
	absolute_path: string;
	relative_path: string;
	file_name: LintFileNameContract;
	text: string;
	normalized_ast: NormalizedAstFileContract;
};

export type TypeScriptLintSourceRecordOptions = {
	absolute_path: string;
	relative_path: string;
	file_name: LintFileNameContract;
	text: string;
	normalized_ast: NormalizedAstFileContract;
	source_resolver: SourceFileResolver;
};
export type TypeScriptAstCreation = {
	ast_file: TypeScriptAstFileContract;
	traversal: TypeScriptAstTraversalContract;
};
export type ContextSourceRecordOptions = {
	repo_root: string;
	file: string;
	text: string;
	source_files: ReadonlyMap<string, ts.SourceFile>;
	python_file_asts: ReadonlyMap<string, NormalizedAstFileContract>;
	typescript_asts: ReadonlyMap<string, NormalizedAstFileContract>;
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
	python_file_asts: ReadonlyMap<string, NormalizedAstFileContract>;
	stage_timer: LintStageTimerContract;
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

export type SourceFileResolver = ReadonlyMap<string, ts.SourceFile>;

export type SourceFileDeclarationMap = Map<string, ts.Declaration>;

export type SourceFileDeclarationCache = WeakMap<ts.SourceFile, SourceFileDeclarationMap>;

export type SourceFileStringSetCache = WeakMap<ts.SourceFile, ReadonlyStringSet>;

export type SourceFileCallableList = readonly ts.FunctionLikeDeclaration[];

export type SourceFileCallableMap = ReadonlyMap<string, SourceFileCallableList>;

export type SourceFileCallableCache = WeakMap<ts.SourceFile, SourceFileCallableMap>;

export type SourceFileReadonlyStringMapCache = WeakMap<ts.SourceFile, ReadonlyStringMap>;

export type SourceFileBooleanMapCache = WeakMap<ts.SourceFile, StringBooleanMap>;

export type AstCallableReferenceContract = {
	name: string;
	kind: CallableReferenceKindContract;
	target_file: string;
	owner: string;
	caller_owner: string;
	is_call: boolean;
	dynamic: boolean;
	line: number;
};

export type CodingRuleSourceOptions = { file: string; text: string };

export type CodingRuleSourceData = {
	file: string;
	text: string;
	normalized_ast: NormalizedAstFileContract;
	source_file: ts.SourceFile;
	source_resolver: SourceFileResolver;
	traversal: TypeScriptAstTraversalContract;
};
