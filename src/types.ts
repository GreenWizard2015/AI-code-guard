import type ts from "typescript";
import type { ArgumentUse, TypedArgument } from "src/model/types";
import type { LintProjectContext, LintStageTimerProtocol, TypeScriptAstFileProtocol, Violation } from "src/protocols";

export type CallableOwnershipResolver = (class_node: AstClassNode, owner: string, method_name: string) => boolean;

type ClassMetricViolationKind = "class_size" | "short_class" | "class_methods";
type CallableMetricViolationKind = "short_function" | "short_method" | "long_function";
type LengthMetricViolationKind = "long_method" | "arguments";
export type MetricViolationKind = ClassMetricViolationKind | CallableMetricViolationKind | LengthMetricViolationKind;

export type AstVisibility = "public" | "protected" | "private";
export type AstLanguage = "python" | "typescript";
export type DuplicateTypeShape = { line: number; names: string[] };
export type NamedShape = { name: string; line: number; fields: string[]; base_names: string[] };
type AstImportTiming = "dynamic" | "nested" | "late";
export type AstImportKind = AstImportTiming | "sys_path_mutation" | "relative";
type NamedCallableKind = "function" | "method";
type NamedDataKind = "variable" | "field";
type NamedDeclarationKind = "constant" | "type_alias";
export type NamedSymbolKind = NamedCallableKind | NamedDataKind | NamedDeclarationKind;
type AstReferenceTypeKind = "named" | "generic" | "template";
export type AstTypeKind = "basic" | AstReferenceTypeKind;

export type AstArgumentUse = { name: string; count: number };
export type AstTypedArgument = {
	name: string;
	type: string;
	kind: AstTypeKind;
};
export type NamedLine = { line: number; name: string };
export type AstStatementNode = {
	kind: AstStatementKind;
	line: number;
	name: string;
	value_name: string;
	simple_alias: boolean;
	destructured: boolean;
};
type AstStatementKind = "assignment" | "return" | "other";
export type AstClassField = {
	line: number;
	name: string;
	value_name: string;
	type: string;
	type_kind: AstTypeKind;
	class_variable: boolean;
};
export type AstPythonImportName = { name: string; alias: string };
export type AstPythonImport = {
	line: number;
	module: string;
	names: AstPythonImportName[];
};
type AstCallableIdentity = {
	name: string;
	owner: string;
	nested: boolean;
	start: number;
	end: number;
	argument_count: number;
};
type AstCallableMetrics = { lines: number; sloc: number; characters: number };
type AstCallableAnalysis = {
	statements: AstStatementNode[];
	parameter_types: string[];
	return_type: string;
	argument_uses: AstArgumentUse[];
	typed_arguments: AstTypedArgument[];
	untyped_parameters: string[];
};
type AstCallableTestFlags = {
	exception_only: boolean;
	has_unittest_assertion: boolean;
	unittest_assertion_alias: boolean;
	unittest_exception_only: boolean;
	test_exception_bypass: boolean;
	unittest_ending_valid: boolean;
	unittest_assertion_count: number;
};
type AstCallablePresentationFlags = {
	decorators: string[];
	is_accessor: boolean;
	has_self: boolean;
	visibility: AstVisibility;
};
/** Responsibilities: _callable analysis representation_. **/
export interface AstCallableNode
	extends AstCallableIdentity,
		AstCallableMetrics,
		AstCallableAnalysis,
		AstCallableTestFlags,
		AstCallablePresentationFlags {}
type AstClassIdentity = { name: string; start: number; end: number; methods: AstCallableNode[] };
type AstClassInheritance = {
	lines: number;
	sloc: number;
	interfaces: string[];
	base_class_name: string;
	base_class_names: string[];
	extends_external_class: boolean;
	is_data_class: boolean;
	type_contract: boolean;
	protocol: boolean;
};
type AstClassDetails = {
	callback_fields: number;
	inline_callback_fields: number;
	fields: AstClassField[];
	untyped_fields: NamedLine[];
	dependencies: string[];
};
export type AstClassNode = AstClassIdentity & AstClassInheritance & AstClassDetails;
export type AstParseIssue = { line: number; message: string };
export type AstImportIssue = { line: number; kind: AstImportKind };
export type AstCodingIssue = { line: number; kind: string };
export type LineDepth = { line: number; depth: number };
export type LineOnly = { line: number };
export type AstCallableReference = {
	name: string;
	kind: CallableReferenceKind;
	owner: string;
	caller_owner: string;
	is_call: boolean;
	dynamic: boolean;
	line: number;
};
type CallableReferenceKind = "function" | "method";
export type NamedSymbol = {
	name: string;
	line: number;
	kind: NamedSymbolKind;
	is_module_constant: boolean;
	is_module_variable: boolean;
	visibility: AstVisibility;
	is_module_function: boolean;
};
export type AstReferenceAlias = { name: string; target: string };
export type AstModuleInstance = { line: number; constructor: string };
export type AstTypeMembers = Record<string, Record<string, string>>;
export type AstSourceSpan = {
	start_line: number;
	start_column: number;
	end_line: number;
	end_column: number;
};
export type PythonAstCacheReadOptions = {
	texts: readonly string[];
	files: readonly string[];
	repo_root: string;
	results: Map<number, NormalizedAstFile>;
	stage_timer: LintStageTimerProtocol;
	stage_prefix: string;
};
export type PythonAstCacheWriteOptions = {
	texts: readonly string[];
	files: readonly string[];
	indexes: readonly number[];
	parsed: readonly NormalizedAstFile[];
	repo_root: string;
	stage_timer: LintStageTimerProtocol;
	stage_prefix: string;
};
export type PythonBatchAstOptions = {
	texts: readonly string[];
	stage_timer: LintStageTimerProtocol;
	stage_prefix: string;
	files: readonly string[];
	repo_root: string;
};
type AstResponsibilityOwnerKind = "class" | "interface";
type AstResponsibilityCallableKind = "method" | "function";
export type AstResponsibilityKind = AstResponsibilityOwnerKind | AstResponsibilityCallableKind;
export type AstResponsibilityTarget = {
	kind: AstResponsibilityKind;
	name: string;
	line: number;
	documentation: string;
};
type NormalizedAstIdentity = {
	language: AstLanguage;
	classes: AstClassNode[];
	functions: AstCallableNode[];
	parse_issues: AstParseIssue[];
	import_issues: AstImportIssue[];
};
type NormalizedAstData = {
	attribute_accesses: LineDepth[];
	named_symbols: NamedSymbol[];
	type_declarations: NamedLine[];
	reference_aliases: AstReferenceAlias[];
};
type NormalizedAstOptionalData = {
	private_accesses: LineOnly[];
	repeated_branches: LineOnly[];
	call_references: AstCallableReference[];
	module_instances: AstModuleInstance[];
	module_constant_spans: AstSourceSpan[];
	module_type_spans: AstSourceSpan[];
	module_protocol_spans: AstSourceSpan[];
	type_members: AstTypeMembers;
	coding_issues: AstCodingIssue[];
	python_imports: AstPythonImport[];
};
type NormalizedAstOptionalMetadata = {
	python_callable_count: FunctionCount;
	python_main_guard: boolean;
	docstring_spans: AstSourceSpan[];
	responsibility_targets: AstResponsibilityTarget[];
};
export type NormalizedAstFile = NormalizedAstIdentity &
	NormalizedAstData &
	NormalizedAstOptionalData &
	NormalizedAstOptionalMetadata;

export type CodeClass = {
	key: string;
	file: string;
	line: number;
	name: string;
	dependencies: string[];
};
export type ImportedSymbol = { file: string; name: string };
export type ClassGraph = {
	classes: Map<string, CodeClass>;
	classes_by_file: Map<string, Map<string, CodeClass>>;
	imports_by_file: Map<string, Map<string, ImportedSymbol>>;
};
export type ImportedFunction = { source_file: string; source_name: string };
export type ClassFieldFiles = { files: string[]; repo_root: string };
export type PreparedCodingRuleSourceOptions = {
	file: string;
	text: string;
	normalized_ast: NormalizedAstFile;
	source_file: ts.SourceFile;
};
export type Assignment = {
	line: number;
	name: string;
	initializer: ts.Expression;
	simple_alias: boolean;
	destructured: boolean;
};
export type NamedDeclaration = { name: string; line: number; has_self: boolean };
export type CallableShapeCounts = { callables: number; data: number };
export type RuleAppender = (node: ts.Node, rule_id: string) => void;
export type ClassFieldRules = {
	missing_visibility(node: ts.Node, file: string): boolean;
	mutable_field(node: ts.Node, file: string): boolean;
};
export type RuleContextData = {
	file: string;
	source_file: ts.SourceFile;
	test_file: boolean;
	class_fields: ClassFieldRules;
	append_rule: RuleAppender;
};
export type PythonLintInput = {
	file_name: FileNameLike;
	text: string;
	project_class_names: ReadonlySet<string>;
	project_protocol_names: ReadonlySet<string>;
	project_type_names: ReadonlySet<string>;
	normalized_ast: NormalizedAstFile;
};
export type FileNameLike = { value: string };
export type LintFileNameContract = {
	value: string;
	is_functions_file: boolean;
	test(): boolean;
	product(): boolean;
	test_py(): boolean;
};
export type LintSourceRecord = {
	absolute_path: string;
	relative_path: string;
	file_name: LintFileNameContract;
	text: string;
	normalized_ast: NormalizedAstFile;
	language: AstLanguage;
	typescript_ast: TypeScriptAstFileProtocol;
	typescript(): boolean;
	python(): boolean;
};
export type LintSourceRecordOptions = {
	absolute_path: string;
	relative_path: string;
	file_name: LintFileNameContract;
	text: string;
	normalized_ast: NormalizedAstFile;
};
export type ContextSourceRecordOptions = {
	repo_root: string;
	file: string;
	text: string;
	source_files: ReadonlyMap<string, ts.SourceFile>;
	python_file_asts: ReadonlyMap<string, NormalizedAstFile>;
	typescript_asts: ReadonlyMap<string, NormalizedAstFile>;
};
export type ContextSourceRecordsOptions = {
	repo_root: string;
	files: string[];
	texts: ReadonlyMap<string, string>;
	source_files: ReadonlyMap<string, ts.SourceFile>;
	python_file_asts: ReadonlyMap<string, NormalizedAstFile>;
	stage_timer: LintStageTimerProtocol;
};
export type TypeScriptTreeMetadata = {
	attribute_accesses: LineDepth[];
	import_issues: AstImportIssue[];
	named_symbols: NamedSymbol[];
	type_declarations: NamedLine[];
};
export type AbsoluteImportCandidate = {
	file: string;
	order: number;
};
export type TestRunnerRequest = {
	readonly args: readonly string[];
	readonly help_requested: boolean;
};

export type LintRunStatistics = {
	source_reads: number;
	typescript_parses: number;
	python_parses: number;
	source_records: number;
};
export type CodingLintFiles = Record<string, string>;
export type CallableOptions = {
	name: string;
	owner: string;
	node: ts.SignatureDeclarationBase;
	visibility: AstVisibility;
};

export type CallableNodeOptions = {
	name: string;
	owner: string;
	node: ts.SignatureDeclarationBase;
	visibility: AstVisibility;
	start: number;
	end: number;
};

export type ClassNodeOptions = {
	node: ts.ClassLikeDeclaration;
	fallback_name: string;
	methods: AstCallableNode[];
	range: SourceRange;
	interfaces: string[];
};
export type ClassNodeData = {
	name: string;
	start: number;
	end: number;
	lines: number;
	sloc: number;
	interfaces: string[];
	base_class_name: string;
	methods: AstCallableNode[];
};
export type InstanceAliasResolvers = {
	call_owner(expression: ts.Expression, owner: string): string;
	property_owner(expression: ts.PropertyAccessExpression, owner: string): string;
};

export type CallableMetricComponents = {
	lines: number;
	sloc: number;
	characters: number;
	argument_uses: ArgumentUse[];
	typed_arguments: TypedArgument[];
};

export type RuleParameters = Record<string, string>;
export type RuleData = {
	message: string;
	hint: string;
	priority: number;
};
export type FunctionCount = { count: number; first_line: number };
export type NamedFunction = {
	name: string;
	line: number;
	has_self: boolean;
	imported: boolean;
};
export type TsMethodScanState = { class_start: number; depth: number };
export type PythonClassMetrics = { end: number; method_count: number };
export type CodingRuleSourceOptions = { file: string; text: string };
export type CodingRuleAstParser = { source_ast(text: string): NormalizedAstFile };
export type ParseLanguage = "python" | "typescript";
export type CallTargetKind = "bound" | "call";
export type CallbackCounts = { readonly total: number; readonly inline: number };
export type CallbackKind = "none" | "typed" | "inline";
export type FieldTypeData = { readonly type: string; readonly type_kind: AstTypeKind };
export type ExpressionUnwrapper = (expression: ts.Expression) => ts.Expression[];
export type PropertyOwner = { property_name: string; owner: string };
export type MaxMethodMetricInput = {
	violations: Violation[];
	file_name: LintFileNameContract;
	node: AstClassNode;
};
export type MixCallableNode = { name: string; start: number; end: number; argument_count: number };
export type Visibility = "public" | "non-public";
export type SourceIdentity = { absolute_path: string; relative_path: string; language: AstLanguage };
export type CommentScanResult = { text: string; in_block_comment: boolean };
export type SourceRange = { start: number; end: number };
export type CommentSegment = {
	text: string;
	in_block_comment: boolean;
	result: CommentScanResult;
	complete: boolean;
};
export type ReportViolation = {
	readonly file: string;
	readonly line: number;
	readonly message: string;
	readonly hint: string;
	readonly rule_id: string;
	readonly priority: number;
};
export type ReferenceData = { referenced: Set<string>; unresolved: Violation[] };
export type CliOptions = {
	ignored_directories: string[];
	entry_files: string[];
	root: string;
	timings: boolean;
	batch_size: number;
	policy: LintTaskPolicy;
};
export type LintTaskPolicy = "top-category" | "all";
export type TaskReportingOptions = { batch_size: number; policy: LintTaskPolicy };
export type LintExecutionReport = { context: LintProjectContext; report: LintRunResult };
export type LintStageDuration = { name: string; duration_ms: number };
export type ProjectNames = {
	project_class_names: ReadonlySet<string>;
	project_protocol_names: ReadonlySet<string>;
	project_interface_names: ReadonlySet<string>;
	project_contract_names: ReadonlySet<string>;
	project_type_names: ReadonlySet<string>;
};
export type TypeMemberEntry = { name: string; members: Record<string, string> };
type LintRunFiles = {
	repo_root: string;
	files: string[];
	ignored_files: ReadonlySet<string>;
	ignored_directories: ReadonlySet<string>;
	project_files: string[];
};

type LintRunContext = {
	context: LintProjectContext;
};

export type LintRunState = LintRunFiles & ProjectNames & LintRunContext;
export type LintRunResult = { files: string[]; violations: Violation[] };
export type LintAnalysisStage = { state: LintRunState; stage_timer: LintStageTimerProtocol };
