import type { ASTVerifierRegistryContract } from "src/ast_verifier_protocols";
import type { FileAnalysisCacheContract } from "src/cache_protocols";
import type { LintFileNameContract } from "src/core/support/protocols";
import type {
	AstCallableNode,
	AstClassNode,
	AstParseIssue,
	AstPythonImport,
	AstReferenceAlias,
	LineDepth,
	NamedLine,
	NamedSymbol,
} from "src/model/ast/normalized_ast_types";
import type { PythonProjectNames } from "src/model_types";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import type { ViolationContract } from "src/reporting_protocols";
import type {
	CodingRuleLinterContract,
	FileViolationCollectorContract,
	LintProjectContextContract,
	LintStageTimerContract,
} from "src/shared_services_protocols";
import type { AstPropertySourceIndexContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type { TypeScriptAstFileContract, TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type ts from "typescript";

/** Responsibilities: _preferred visible declaration_. **/
export type PreferredVariableDeclaration = {
	found: boolean;
	declaration: ts.Node;
	scope_index: number;
};

export type TypeScriptVariableDeclarationsByName = Map<string, ts.VariableDeclaration[]>;

export type PythonOperationInput = {
	callables: AstCallableNode[];
	methods: AstCallableNode[];
	attribute_accesses: LineDepth[];
	private_accesses: { line: number }[];
	repeated_branches: { line: number }[];
	functions: AstCallableNode[];
	parse_issues: AstParseIssue[];
	named_symbols: NamedSymbol[];
	symbol_references: NamedLine[];
};

/** Responsibilities: _complete Python rule input_. **/
export type PythonProjectTypeNames = {
	readonly classes: ReadonlySet<string>;
	readonly protocols: ReadonlySet<string>;
	readonly types: ReadonlySet<string>;
	readonly type_aliases: ReadonlySet<string>;
};

export type PythonRuleSource = {
	readonly text: string;
	readonly classes: AstClassNode[];
	readonly type_declarations: NamedLine[];
	readonly functions: AstCallableNode[];
	readonly reference_aliases: AstReferenceAlias[];
	readonly python_imports: AstPythonImport[];
};

export type PythonRuleProjectContext = {
	readonly classes: ReadonlySet<string>;
	readonly protocols: ReadonlySet<string>;
	readonly types: ReadonlySet<string>;
	readonly type_aliases: ReadonlySet<string>;
	readonly suppress_short_class: boolean;
	readonly production_import_names: ReadonlySet<string>;
};

export type PythonRuleInput = {
	readonly violations: ViolationContract[];
	readonly file_name: LintFileNameContract;
	readonly source: PythonRuleSource;
	readonly operations: PythonOperationInput;
	readonly project: PythonRuleProjectContext;
};

/** Responsibilities: _TypeScript scanner input_. **/
export type TypeScriptScannerInput = {
	file_name: LintFileNameContract;
	text: string;
	ast_file: TypeScriptAstFileContract;
	traversal: TypeScriptAstTraversalContract;
	stage_timer: LintStageTimerContract;
};

export type CodingRuleSourceServices = {
	module_exports: TypeScriptModuleExportsContract;
	source_index: AstPropertySourceIndexContract;
	node_rules: ASTVerifierRegistryContract;
};
export type CachedFileOptions = {
	file: string;
	source: LintSourceRecordData;
	ignored: boolean;
	stage_timer: LintStageTimerContract;
	cache: FileAnalysisCacheContract;
};

export type FileAnalysisOptions = {
	source: LintSourceRecordData;
	ignored: boolean;
	stage_timer: LintStageTimerContract;
	names: PythonProjectNames;
	repo_root: string;
	coding_rule_linter: CodingRuleLinterContract;
	violation_collector: FileViolationCollectorContract;
};

export type FileLintOptions = {
	file: string;
	repo_root: string;
	stage_timer: LintStageTimerContract;
	names: PythonProjectNames;
	context: LintProjectContextContract;
	ignored_files: ReadonlySet<string>;
	cache: FileAnalysisCacheContract;
	coding_rule_linter: CodingRuleLinterContract;
	violation_collector: FileViolationCollectorContract;
};
