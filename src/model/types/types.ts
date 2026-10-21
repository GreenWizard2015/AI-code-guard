import type { StringSetMap } from "src/analysis_types";
import type { AstCacheAstContract } from "src/cache_types";
import type { IOContract } from "src/io/protocols";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import type { ProjectNamesContract } from "src/project_analysis_types";
import type { PythonImportResolutionContract } from "src/python_protocols";
import type { ReportViolation } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { LintStageDuration } from "src/runtime_types";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourcePythonContract } from "src/source_protocols";
import type { LintFileNameContract, LintSourceRecord } from "src/source_types";
import type {
	AstCallableNodeContract,
	AstClassNodeContract,
	AstPythonImport,
	AstSourceSpan,
	ImportedFunction,
	LineOnly,
	NamedLine,
	NormalizedAstFileContract,
	ReviewAgentPhase,
	RuleParameters,
} from "src/types";
import type { AstStatementNode } from "src/types";
import type { TypeScriptScriptRuleServicesContract } from "src/typescript_analysis_protocols";
import type { TypeScriptAstFileContract, TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type ts from "typescript";

export type NamedDeclaration = { name: string; line: number; has_self: boolean };
export type LineViolation = { line: number };
export type SimpleViolationGroup = { items: LineViolation[]; rule_id: string };
export type ArchitectureInput = {
	violations: ViolationContract[];
	file: string;
	accesses: LineOnly[];
	branches: LineOnly[];
	classes: AstClassNodeContract[];
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
	normalized_ast: NormalizedAstFileContract;
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
	project_names: ProjectNamesContract;
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
/** Responsibilities: _scanner source inputs_. **/
interface TypeScriptScannerSourceOptionsContract {
	readonly file_name: LintFileNameContract;
	readonly text: string;
	readonly ast_file: TypeScriptAstFileContract;
	readonly traversal: TypeScriptAstTraversalContract;
	readonly stage_timer: LintStageTimerContract;
}
/** Responsibilities: _scanner project name indexes_. **/
interface TypeScriptScannerProjectNamesContract {
	readonly project_class_names: ReadonlySet<string>;
	readonly typescript_class_names: ReadonlySet<string>;
	readonly project_interface_names: ReadonlySet<string>;
	readonly project_type_names: ReadonlySet<string>;
	readonly project_contract_names: ReadonlySet<string>;
	readonly project_boundary_types: ReadonlySet<string>;
	readonly project_boundary_contracts: ReadonlySet<string>;
}
/** Responsibilities: _scanner module scope_. **/
export interface TypeScriptScannerModuleScopeContract {
	readonly module_resolver: TypeScriptModuleResolverContract;
	readonly project_files: ReadonlySet<string>;
}
/** Responsibilities: _TypeScript scanner options_. **/
export interface TypeScriptScannerOptionsContract
	extends TypeScriptScannerSourceOptionsContract,
		TypeScriptScannerProjectNamesContract,
		TypeScriptScannerModuleScopeContract {}

export type TypeScriptScannerRuleSource = {
	file_name: LintFileNameContract;
	lines: string[];
	ast_file: TypeScriptAstFileContract;
	traversal: TypeScriptAstTraversalContract;
	ast: NormalizedAstFileContract;
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
	ast: NormalizedAstFileContract;
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
export type PythonClassNameSet = ReadonlySet<string>;
export type PythonClassNamesByFile = Map<string, PythonClassNameSet>;
export type JestScopeBindingMap = Map<string, ts.Declaration>;
export type JestScopeBindingMaps = WeakMap<ts.Node, JestScopeBindingMap>;
export type JestScopeParents = WeakMap<ts.Node, ts.Node>;
export type JestNodeScopes = WeakMap<ts.Node, ts.Node>;
export type JestExecutionConsumer = (node: ts.Node) => void;
export type TemporalFieldEffect = { read: boolean; write: boolean };
export type BooleanCallTarget = { name: string };
export type CallableBodyKind = "unsupported" | "expression" | "declaration";
export type ObjectPropertyIndex = ReadonlyMap<string, ts.PropertyAssignment>;
export type StaticExpressionValueMap = ReadonlyMap<string, string>;
export type StaticExpressionScopeValues = ReadonlyMap<ts.Node, StaticExpressionValueMap>;
export type StaticExpressionBindingNames = ReadonlySet<string>;
export type StaticKeyCollectionState = {
	values: Map<string, string>;
	objects: Map<string, ts.ObjectLiteralExpression>;
};
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

export type ParsedClassFile = { file: string; ast: NormalizedAstFileContract };
export type ClassDefinition = { file: string; node: AstClassNodeContract };
export type ViolationContent = { rule_id: string; parameters: RuleParameters };
export type ContractKind = "interface" | "protocol";
export type DirectoryFileViolationOptions = {
	violations: ViolationContract[];
	file: string;
	text: string;
	classes: readonly AstClassNodeContract[];
	docstring_spans: readonly AstSourceSpan[];
	normalized_ast: NormalizedAstFileContract;
};
export type DirectoryViolationContext = {
	directory_sources: ReadonlyMap<string, readonly string[]>;
	source_directory_children: ReadonlySourceDirectoryChildren;
	repo_root: string;
	class_counts: ReadonlyMap<string, readonly AstClassNodeContract[]>;
	source_asts: ReadonlyMap<string, NormalizedAstFileContract>;
};
export type SourceDirectoryChildNames = Set<string>;
export type SourceDirectoryChildMap = Map<string, SourceDirectoryChildNames>;
export type ReadonlySourceDirectoryChildNames = ReadonlySet<string>;
export type ReadonlySourceDirectoryChildren = ReadonlyMap<string, ReadonlySourceDirectoryChildNames>;
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
export type SourceTextOccurrence = { line: number; text: string };
export type PythonQuoteDelimiter = "'" | '"';
export type PythonQuoteState = {
	active: boolean;
	delimiter: PythonQuoteDelimiter;
	triple: boolean;
	formatted: boolean;
	expression_depth: number;
	expression_quote: string;
	expression_escaped: boolean;
};
/** Responsibilities: _Python quote completion context_. **/
export interface QuoteCompletionContract {
	readonly line: string;
	readonly index: number;
	readonly next: number;
	readonly state: PythonQuoteState;
	readonly parts: string[];
	readonly line_number: number;
}

export type AstCacheRecord = {
	cache_version: number;
	project_identity: string;
	source_file: string;
	source_hash: string;
	ast: AstCacheAstContract;
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
