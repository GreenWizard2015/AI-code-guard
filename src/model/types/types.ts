import type {
	AstClassNode,
	AstCallableNodeContract,
	AstPythonImport,
	AstSourceSpan,
	ImportedFunction,
	LintFileNameContract,
	LintSourceRecord,
	LineOnly,
	NamedLine,
	NormalizedAstFile,
	AstCacheAst,
	LintStageDuration,
	ProjectNames,
	ReportViolation,
	RuleParameters,
	ReviewAgentPhase,
} from "src/types";
import type {
	LintProjectContextContract,
	ProjectAnalysisIdentityContract,
	ProjectSourcePythonContract,
	PythonImportResolutionContract,
	TypeScriptScriptRuleServicesContract,
	ViolationContract,
} from "src/protocols";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import type { LintStageTimerContract, TypeScriptAstFileContract, TypeScriptAstTraversalContract } from "src/protocols";
import type { StringSetMap } from "src/protocols";
import type { AstStatementNode } from "src/types";
import ts from "typescript";
import type { IOContract } from "src/io/protocols";

export type NamedDeclaration = { name: string; line: number; has_self: boolean };
export type LineViolation = { line: number };
export type SimpleViolationGroup = { items: LineViolation[]; rule_id: string };
export type ArchitectureInput = {
	violations: ViolationContract[];
	file: string;
	accesses: LineOnly[];
	branches: LineOnly[];
	classes: AstClassNode[];
	imports: readonly AstPythonImport[];
};
export type PythonLintInput = {
	file_name: LintFileNameContract;
	source_file: string;
	text: string;
	project_class_names: ReadonlySet<string>;
	python_class_names: ReadonlySet<string>;
	project_protocol_names: ReadonlySet<string>;
	project_type_names: ReadonlySet<string>;
	normalized_ast: NormalizedAstFile;
};
export type PythonProjectNames = {
	project_class_names: ReadonlySet<string>;
	project_protocol_names: ReadonlySet<string>;
	project_type_names: ReadonlySet<string>;
};
export type PythonTestFramework = "pytest" | "unittest";
export type TestFrameworkFile = { source: LintSourceRecord; framework: PythonTestFramework };

export type FileLinterOptions = {
	repo_root: string;
	project_names: ProjectNames;
	context: LintProjectContextContract;
	ignored_files: ReadonlySet<string>;
	analysis_identity: ProjectAnalysisIdentityContract;
	cache_enabled: boolean;
	file_io: IOContract;
};
export type RemainingViolationOptions = {
	violations: ViolationContract[];
	source: LintSourceRecord;
	file: string;
	text: string;
	python: boolean;
	stage_timer: LintStageTimerContract;
};
export type TypeScriptScannerSourceOptions = {
	file_name: LintFileNameContract;
	text: string;
	ast_file: TypeScriptAstFileContract;
	traversal: TypeScriptAstTraversalContract;
	stage_timer: LintStageTimerContract;
};
export type TypeScriptScannerProjectNames = {
	project_class_names: ReadonlySet<string>;
	typescript_class_names: ReadonlySet<string>;
	project_interface_names: ReadonlySet<string>;
	project_type_names: ReadonlySet<string>;
	project_contract_names: ReadonlySet<string>;
	project_boundary_types: ReadonlySet<string>;
	project_boundary_contracts: ReadonlySet<string>;
};
export type TypeScriptScannerModuleScope = {
	module_resolver: TypeScriptModuleResolverContract;
	project_files: ReadonlySet<string>;
};
export type TypeScriptScannerOptions = TypeScriptScannerSourceOptions &
	TypeScriptScannerProjectNames &
	TypeScriptScannerModuleScope;
export type TypeScriptScannerRuleSource = {
	file_name: LintFileNameContract;
	lines: string[];
	ast_file: TypeScriptAstFileContract;
	traversal: TypeScriptAstTraversalContract;
	ast: NormalizedAstFile;
	stage_timer: LintStageTimerContract;
	script_rule_services: TypeScriptScriptRuleServicesContract;
};
export type TypeScriptScannerRuleNames = {
	project_class_names: ReadonlySet<string>;
	project_interface_names: ReadonlySet<string>;
	project_type_names: ReadonlySet<string>;
	project_contract_names: ReadonlySet<string>;
	project_boundary_types: ReadonlySet<string>;
	project_boundary_contracts: ReadonlySet<string>;
};
export type TypeScriptScannerRuleModuleScope = {
	module_resolver: TypeScriptModuleResolverContract;
};
export type PerformanceReportOptions = {
	root: string;
	files: readonly string[];
	durations: readonly LintStageDuration[];
};
/** Responsibilities: _TypeScript scanner rule context_. **/
export interface TypeScriptScannerRuleContextContract
	extends TypeScriptScannerRuleSource,
		TypeScriptScannerRuleNames,
		TypeScriptScannerRuleModuleScope {}
export type PythonClassFieldCollectionOptions = {
	file: string;
	ast: NormalizedAstFile;
	repo_root: string;
	function_by_file: StringSetMap;
	files: ReadonlySet<string>;
	python_import_resolution: PythonImportResolutionContract;
};

export type ResponsibilityValues = { present: boolean; values: string[]; format_valid: boolean };
export type ResponsibilityLimits = { minimum: number; maximum: number };
export type CodeClass = { key: string; file: string; line: number; name: string; dependencies: string[] };
export type ImportedSymbol = { file: string; name: string };
export type CodeClassByName = Map<string, CodeClass>;
export type CodeClassesByFile = Map<string, CodeClassByName>;
export type ImportedSymbolByName = Map<string, ImportedSymbol>;
export type ImportedSymbolsByFile = Map<string, ImportedSymbolByName>;
export type ClassGraph = {
	classes: Map<string, CodeClass>;
	classes_by_file: CodeClassesByFile;
	imports_by_file: ImportedSymbolsByFile;
};
export type CompositionResult = { classes: CodeClass[]; imports: Map<string, ImportedSymbol> };
export type PythonAssignment = { line: number; name: string; simple_alias: boolean; destructured: boolean };
export type ReturnViolationContext = {
	violations: ViolationContract[];
	file: string;
	candidates: PythonAssignment[];
	kind: PythonAssignmentKind;
	name: string;
};
type PythonAssignmentKind = "assignment" | "return" | "other";
export type StatementContext = {
	violations: ViolationContract[];
	file: string;
	candidates: PythonAssignment[];
	statement: AstStatementNode;
};
export type Branch = { line: number; name: string };
export type Assignment = {
	line: number;
	name: string;
	initializer: ts.Expression;
	simple_alias: boolean;
	destructured: boolean;
};
export type AssignmentDetails = {
	name: string;
	initializer: ts.Expression;
	simple_alias: boolean;
	destructured: boolean;
};

export type TaskFileSelection = {
	files: string[];
	violations: ReportViolation[];
};

export type HookToolInput = {
	command: string;
	file_path: string;
	path: string;
	patch: string;
	workdir: string;
	shell: string;
	login: boolean;
};

export type HookPayload = {
	event: string;
	hook_event_name: string;
	tool_name: string;
	tool_input: HookToolInput;
	cwd: string;
	review_stage: string;
	review_prefix: string;
	review_phase: ReviewAgentPhase;
};

export type HookDecision = { allowed: boolean; reason: string };

export type ParsedClassFile = { file: string; ast: NormalizedAstFile };
export type ClassDefinition = { file: string; node: AstClassNode };
export type ViolationContent = { rule_id: string; parameters: RuleParameters };
export type ContractKind = "interface" | "protocol";
export type DirectoryFileViolationOptions = {
	violations: ViolationContract[];
	file: string;
	text: string;
	classes: readonly AstClassNode[];
	docstring_spans: readonly AstSourceSpan[];
	normalized_ast: NormalizedAstFile;
};
export type DirectoryViolationContext = {
	directory_sources: ReadonlyMap<string, readonly string[]>;
	repo_root: string;
	class_counts: ReadonlyMap<string, number>;
	source_asts: ReadonlyMap<string, NormalizedAstFile>;
};
export type ClassField = { line: number; name: string; value_name: string };
export type FieldContext = {
	repo_root: string;
	imports: Map<string, ImportedFunction>;
	function_by_file: StringSetMap;
};
export type ClassSummaryOptions = {
	violations: ViolationContract[];
	file: string;
	lines: string[];
	python: boolean;
	parsed_indexes: number[];
	has_module_functions: boolean;
};
export type PythonClassSummaryOptions = {
	violations: ViolationContract[];
	file: string;
	lines: string[];
	parsed_indexes: number[];
	has_module_functions: boolean;
	has_implementation_classes: boolean;
	type_declarations: readonly NamedLine[];
};
export type CyrillicQuoteDelimiter = "'" | '"';
export type CyrillicCommentText = { line: number; text: string };
export type CyrillicQuoteState = { active: boolean; delimiter: CyrillicQuoteDelimiter; triple: boolean };

export type AstCacheRecord = {
	cache_version: number;
	project_identity: string;
	source_file: string;
	source_hash: string;
	ast: AstCacheAst;
};
export type ClassNodeInput = {
	name: string;
	start: number;
	end: number;
	methods: AstCallableNodeContract[];
	base_class_name: string;
	base_class_names: string[];
	type_contract: boolean;
	protocol: boolean;
};
export type ViolationCounts = {
	files: number;
	total: number;
};

export type PlacementFunctionNode = { start: number; nested: boolean };
export type UnresolvedSpecifierInput = {
	file: string;
	path: string;
	specifier: string;
	files: Set<string>;
	python: ProjectSourcePythonContract;
};
export type ProjectContextState = { available: boolean; value: LintProjectContextContract };
export type ProjectSourceOptions = {
	context_state: ProjectContextState;
	entry_files: readonly string[];
};
