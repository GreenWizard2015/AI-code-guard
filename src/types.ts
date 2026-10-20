import type { ArgumentUse, TypedArgument } from "src/model/types";
import type ts from "typescript";
import type { TypeScriptPropertyModuleResolverContract } from "src/module-resolution/types";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { SourceFileResolver } from "src/source_types";
import type { AstPropertySourceIndexContract } from "src/source_protocols";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { TypeScriptNodeRulesContract } from "src/typescript_analysis_protocols";
import type { FileNameLike, LintFileNameContract } from "src/source_types";

export type TaskIssueFileViolationDetails = {
	messages: ReadonlySet<string>;
	hints: ReadonlySet<string>;
	single_violation: boolean;
};

export type StageOperation<T> = () => T;
export type ReviewAgentName = "codex" | "claude";
export type ReviewAgentSelection = ReviewAgentName | "none";
export type ReviewAgentPhase = "initial" | "cleanup";
export type ReviewStageDefinition = { id: string; prefix: string; focus: string; document: string };
export type ReviewAgentHookConfiguration = {
	hook_file: string;
	hook_command: string;
	review_prefix: string;
	review_phase: ReviewAgentPhase;
};
export type ReviewAgentRequest = {
	root: string;
	instruction: string;
	review_root: string;
	hook: ReviewAgentHookConfiguration;
	review_stage: string;
	review_stage_plan: string;
	open_review_files: readonly string[];
	prompt: string;
};
export type ReviewAgentPromptRequest = { prompt_request: ReviewAgentRequest };
export type ReviewAgentCleanupRequest = { cleanup_request: ReviewAgentRequest };
export type ReviewAgentRunRequest = { run_request: ReviewAgentRequest };
export type ReviewAgentProcessResult = { exit_code: number; stdout: string; stderr: string };

export type TypeScriptRuleContextOptions = {
	stage_timer: LintStageTimerContract;
	source_resolver: SourceFileResolver;
	node_rules: TypeScriptNodeRulesContract;
	module_exports: TypeScriptPropertyModuleResolverContract;
	source_index: AstPropertySourceIndexContract;
	traversal: TypeScriptAstTraversalContract;
};
export type ReviewAgentHookEventName = string;
/** Responsibilities: _review-agent hook identity_, _review-agent process result_. **/
type ReviewAgentHookIdentity = {
	event: ReviewAgentHookEventName;
	provider: ReviewAgentSelection;
	root: string;
	review_root: string;
	hook_file: string;
	review_stage: string;
	review_prefix: string;
	review_phase: ReviewAgentPhase;
};
type ReviewAgentHookProcess = {
	tool_name: string;
	tool_input: string;
	exit_code: number;
	stdout: string;
	stderr: string;
};
/** Responsibilities: _review-agent hook event transport_. **/
export interface ReviewAgentHookEventContract extends ReviewAgentHookIdentity, ReviewAgentHookProcess {}
export type TaskReviewRunResult = { provider: ReviewAgentName | "none"; message: string };
export type ReviewAgentExecutionResult = {
	provider: ReviewAgentName | "none";
	process: ReviewAgentProcessResult;
	no_issues: boolean;
	message: string;
};

export type CallableOwnershipRequest = {
	class_node: AstClassNode;
	owner: string;
	method_name: string;
	source_file: string;
};
export type CallableOwnershipResolver = (request: CallableOwnershipRequest) => boolean;

type ClassMetricViolationKind = "class_size" | "short_class" | "class_methods";
type CallableMetricViolationKind = "short_function" | "short_method" | "long_function";
type LengthMetricViolationKind = "long_method" | "arguments";
export type MetricViolationKind = ClassMetricViolationKind | CallableMetricViolationKind | LengthMetricViolationKind;

export type AstVisibility = "public" | "protected" | "private";
export type AstLanguage = "python" | "typescript";
export type JestCallbackKind = "arrow" | "function" | "other";
export type JestSuite = {
	node: ts.CallExpression;
	body: ts.Block[];
	tests: ts.CallExpression[];
	nested: boolean;
};
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
	readonly: boolean;
	class_variable: boolean;
	visibility: AstVisibility;
};
export type AstPythonImportName = { name: string; alias: string };
export type AstPythonImportKind = "import" | "from";
export type AstPythonImport = {
	line: number;
	kind: AstPythonImportKind;
	module: string;
	names: AstPythonImportName[];
};
export type PythonProjectImportExpansion = {
	specifiers: string[];
	module: string;
	names: AstPythonImportName[];
	root: string;
	importer: string;
	files: ReadonlySet<string>;
};
export type TestTargetImport = { specifier: string; names: string[]; usage_count: number };
type AstCallableIdentity = {
	name: string;
	owner: string;
	nested: boolean;
	start: number;
	end: number;
	argument_count: number;
};
type AstCallableMetrics = { lines: number; sloc: number; characters: number; control_flow_depth: number };
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
export interface AstCallableNodeContract
	extends AstCallableIdentity,
		AstCallableMetrics,
		AstCallableAnalysis,
		AstCallableTestFlags,
		AstCallablePresentationFlags {}
type AstClassIdentity = { name: string; start: number; end: number; methods: AstCallableNodeContract[] };
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
export type AstCodingIssue = { line: number; kind: string; name: string };
export type LineDepth = { line: number; depth: number };
export type LineOnly = { line: number };
export type AstCallableReference = {
	name: string;
	kind: CallableReferenceKind;
	target_file: string;
	owner: string;
	caller_owner: string;
	is_call: boolean;
	dynamic: boolean;
	line: number;
};
export type CallableReferenceIdentity = { name: string; target_file: string };
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
// Symbol references share the common named-line representation.
export type AstLiteralReference = { value: string; line: number };
export type AstLiteralConstant = { value: string; name: string; line: number };
export type AstReferenceAlias = { name: string; target: string };
export type AstModuleInstance = { line: number; constructor: string };
export type AstTypeMemberRecord = Map<string, string>;
export type AstTypeMembers = Map<string, AstTypeMemberRecord>;
export type AstTypeMemberSerialized = { name: string; type: string };
export type AstTypeMemberSerializedGroup = { name: string; members: AstTypeMemberSerialized[] };
export type AstTypeMembersSerialized = AstTypeMemberSerializedGroup[];
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
	stage_timer: LintStageTimerContract;
	stage_prefix: string;
};
export type PythonAstCacheWriteOptions = {
	texts: readonly string[];
	files: readonly string[];
	indexes: readonly number[];
	parsed: readonly NormalizedAstFile[];
	repo_root: string;
	stage_timer: LintStageTimerContract;
	stage_prefix: string;
};
export type PythonBatchAstOptions = {
	texts: readonly string[];
	stage_timer: LintStageTimerContract;
	stage_prefix: string;
	files: readonly string[];
	repo_root: string;
};
export type PythonAstCachePreparation = {
	results: Map<number, NormalizedAstFile>;
	missing_indexes: readonly number[];
	missing_texts: readonly string[];
};
export type PythonAstCacheBatch = {
	options: PythonBatchAstOptions;
	cache: PythonAstCachePreparation;
};
export type PythonBatchAstPreparation = {
	options: PythonBatchAstOptions;
	cache: PythonAstCachePreparation;
	batch_id: string;
	started_at: number;
};
export type PythonSourceAstBatch = {
	files: readonly string[];
	batch_id: string;
};
type AstResponsibilityOwnerKind = "class" | "interface" | "record";
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
	functions: AstCallableNodeContract[];
	parse_issues: AstParseIssue[];
	import_issues: AstImportIssue[];
};
type NormalizedAstData = {
	attribute_accesses: LineDepth[];
	named_symbols: NamedSymbol[];
	type_declarations: NamedLine[];
	reference_aliases: AstReferenceAlias[];
};
type NormalizedAstReferenceData = {
	symbol_references: NamedLine[];
	literal_references: AstLiteralReference[];
	literal_constants: AstLiteralConstant[];
	call_references: AstCallableReference[];
	type_members: AstTypeMembers;
};
type NormalizedAstModuleData = {
	private_accesses: LineOnly[];
	repeated_branches: LineOnly[];
	module_instances: AstModuleInstance[];
	module_constant_spans: AstSourceSpan[];
	module_type_spans: AstSourceSpan[];
	module_protocol_spans: AstSourceSpan[];
};
type NormalizedAstLanguageData = {
	coding_issues: AstCodingIssue[];
	python_imports: AstPythonImport[];
};
type NormalizedAstOptionalData = NormalizedAstReferenceData & NormalizedAstModuleData & NormalizedAstLanguageData;
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
export type CodeClassByName = Map<string, CodeClass>;
export type CodeClassesByFile = Map<string, CodeClassByName>;
export type ImportedSymbolByName = Map<string, ImportedSymbol>;
export type ImportedSymbolsByFile = Map<string, ImportedSymbolByName>;
export type ClassGraph = {
	classes: Map<string, CodeClass>;
	classes_by_file: CodeClassesByFile;
	imports_by_file: ImportedSymbolsByFile;
};
export type ImportedFunction = { source_file: string; source_name: string };
export type ClassFieldFiles = { files: string[]; repo_root: string };
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
	source_resolver: SourceFileResolver;
	module_resolver: TypeScriptPropertyModuleResolverContract;
	test_file: boolean;
	class_fields: ClassFieldRules;
	append_rule: RuleAppender;
};
export type PythonLintInput = {
	file_name: FileNameLike;
	source_file: string;
	text: string;
	project_class_names: ReadonlySet<string>;
	project_protocol_names: ReadonlySet<string>;
	project_type_names: ReadonlySet<string>;
	normalized_ast: NormalizedAstFile;
};
export type LintRunStatistics = {
	source_reads: number;
	typescript_parses: number;
	python_parses: number;
	source_records: number;
};
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
	methods: AstCallableNodeContract[];
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
	methods: AstCallableNodeContract[];
};
export type InstanceAliasResolvers = {
	call_owner(expression: ts.Expression, owner: string): string;
	property_owner(expression: ts.PropertyAccessExpression, owner: string): string;
};
export type TypeScriptPropertySide = "instance" | "static";

export type CallableMetricComponents = {
	lines: number;
	sloc: number;
	characters: number;
	control_flow_depth: number;
	argument_uses: ArgumentUse[];
	typed_arguments: TypedArgument[];
};

export type RuleParameters = Record<string, string>;
export type FunctionCount = { count: number; first_line: number };
export type ParseLanguage = "python" | "typescript";
export type CallTargetKind = "bound" | "call";
export type CallbackCounts = { readonly total: number; readonly inline: number };
export type CallbackKind = "none" | "typed" | "inline";
export type FieldTypeData = { readonly type: string; readonly type_kind: AstTypeKind };
export type ExpressionUnwrapper = (expression: ts.Expression) => ts.Expression[];
export type PropertyOwner = { property_name: string; owner: string };
export type MaxMethodMetricInput = {
	violations: ViolationContract[];
	file_name: LintFileNameContract;
	node: AstClassNode;
};
export type MixCallableNode = { name: string; start: number; end: number; argument_count: number };
export type CommentScanResult = { text: string; in_block_comment: boolean };
export type CommentScanOptions = { in_block_comment: boolean; python: boolean };
export type TypeScriptAssignmentContext = { test_file: boolean; inside_constructor: boolean };
export type AstImportIssueFlags = { dynamic: boolean; nested: boolean; relative: boolean };
export type SourceRange = { start: number; end: number };
export type CommentSegment = {
	text: string;
	in_block_comment: boolean;
	result: CommentScanResult;
	complete: boolean;
};
export type SourceReference = { file: string; line: number };
export type SourceReferenceRelation = "implementation" | "usage";
export type SourceReferenceMap<TKey extends {}> = Map<TKey, SourceReference[]>;
