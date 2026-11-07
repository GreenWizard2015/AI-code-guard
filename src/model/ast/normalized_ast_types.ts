import type { LintStageTimerContract } from "src/shared_services_protocols";
import type ts from "typescript";

export type AstVisibility = "public" | "protected" | "private";
export type AstLanguage = "python" | "typescript";

/** Responsibilities: _metadata node flag mapping_. **/
export type TypeScriptMetadataNodeFlagGroup = {
	readonly node_kinds: readonly ts.SyntaxKind[];
	readonly flags: number;
};

/** Responsibilities: _metadata node index configuration_. **/
export type TypeScriptMetadataNodeIndexConfiguration = {
	readonly flags_by_kind: ReadonlyMap<ts.SyntaxKind, number>;
	readonly node_kinds: readonly ts.SyntaxKind[];
};

export type ImportedFunction = { source_file: string; source_name: string };
export type ClassFieldFiles = { files: string[]; repo_root: string };
export type JestCallbackKind = "arrow" | "function" | "other";
export type JestSuite = {
	node: ts.CallExpression;
	body: ts.Block[];
	tests: ts.CallExpression[];
	nested: boolean;
};
export type DuplicateTypeShape = { readonly line: number; readonly names: readonly string[] };
export type NamedShape = { name: string; line: number; fields: string[]; base_names: readonly string[] };
type AstImportTiming = "dynamic" | "nested" | "late";
export type AstImportKind = AstImportTiming | "sys_path_mutation" | "relative";
type NamedCallableKind = "function" | "method";
type NamedDataKind = "variable" | "field" | "type_field";
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
	class_scope: boolean;
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
export type TestTargetImport = { specifier: string; names: string[]; usage_count: number };
/** Responsibilities: _callable identity and source position_. **/
export type AstCallableIdentity = {
	name: string;
	owner: string;
	nested: boolean;
	start: number;
	end: number;
	visibility: AstVisibility;
};

/** Responsibilities: _callable size and control-flow measurements_. **/
export type AstCallableMetrics = {
	argument_count: number;
	lines: number;
	sloc: number;
	characters: number;
	control_flow_depth: number;
};

/** Responsibilities: _callable signature and body data_. **/
export type AstCallableSignature = {
	statements: AstStatementNode[];
	parameter_types: string[];
	return_type: string;
	argument_uses: AstArgumentUse[];
	typed_arguments: AstTypedArgument[];
	untyped_parameters: string[];
};

/** Responsibilities: _callable test and exception behavior_. **/
export type AstCallableTestBehavior = {
	exception_only: boolean;
	has_unittest_assertion: boolean;
	unittest_assertion_alias: boolean;
	unittest_exception_only: boolean;
	test_exception_bypass: boolean;
	unittest_ending_valid: boolean;
	unittest_assertion_count: number;
};

/** Responsibilities: _callable declaration metadata_. **/
export type AstCallableDeclaration = {
	decorators: string[];
	is_accessor: boolean;
	has_self: boolean;
};

/** Responsibilities: _callable analysis representation_. **/
export type AstCallableNode = {
	identity: AstCallableIdentity;
	metrics: AstCallableMetrics;
	signature: AstCallableSignature;
	test_behavior: AstCallableTestBehavior;
	declaration: AstCallableDeclaration;
};

/** Responsibilities: _AST class identity and size_. **/
export type AstClassNodeIdentity = {
	readonly name: string;
	readonly start: number;
	readonly end: number;
	readonly lines: number;
	readonly sloc: number;
};

/** Responsibilities: _AST class members and dependencies_. **/
export type AstClassNodeStructure = {
	readonly methods: AstCallableNode[];
	readonly interfaces: string[];
	readonly base_class_names: readonly string[];
	readonly dependencies: string[];
};

/** Responsibilities: _AST class classification_. **/
export type AstClassNodeClassification = {
	readonly extends_external_class: boolean;
	readonly is_data_class: boolean;
	readonly type_contract: boolean;
	readonly protocol: boolean;
};

/** Responsibilities: _AST class field analysis_. **/
export type AstClassNodeFieldAnalysis = {
	readonly callback_fields: number;
	readonly inline_callback_fields: number;
	readonly fields: AstClassField[];
	readonly untyped_fields: NamedLine[];
};

/** Responsibilities: _AST class model_. **/
export type AstClassNode = {
	identity: AstClassNodeIdentity;
	structure: AstClassNodeStructure;
	classification: AstClassNodeClassification;
	field_analysis: AstClassNodeFieldAnalysis;
};
export type AstParseIssue = { line: number; message: string };
export type AstImportIssue = { line: number; kind: AstImportKind };
export type AstCodingIssue = { line: number; kind: string; name: string };
export type LineDepth = { line: number; depth: number };
export type LineOnly = { line: number };
export type AstCallableUse = {
	assigned_name: string;
	assigned_type_name: string;
	callee_name: string;
	receiver_name: string;
	receiver_constructor_name: string;
	deferred: boolean;
};
export type AstCallableReference = {
	name: string;
	kind: CallableReferenceKind;
	target_file: string;
	owner: string;
	caller_owner: string;
	is_call: boolean;
	dynamic: boolean;
	line: number;
	call_use: AstCallableUse;
};
export type CallableReferenceIdentity = { name: string; target_file: string };
export type CallableReferenceKind = "function" | "method";
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
export type FunctionCount = { count: number; first_line: number };
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
/** Responsibilities: _normalized AST source declarations_. **/
export type NormalizedAstSource = {
	readonly language: AstLanguage;
	readonly classes: AstClassNode[];
	readonly functions: AstCallableNode[];
	readonly parse_issues: AstParseIssue[];
	readonly import_issues: AstImportIssue[];
	readonly coding_issues: AstCodingIssue[];
	readonly python_imports: AstPythonImport[];
};

/** Responsibilities: _normalized AST symbols and references_. **/
export type NormalizedAstSymbolReferences = {
	readonly attribute_accesses: LineDepth[];
	readonly named_symbols: NamedSymbol[];
	readonly type_declarations: NamedLine[];
	readonly reference_aliases: AstReferenceAlias[];
	readonly symbol_references: NamedLine[];
	readonly literal_references: AstLiteralReference[];
	readonly literal_constants: AstLiteralConstant[];
	readonly call_references: AstCallableReference[];
	readonly type_members: AstTypeMembers;
};

/** Responsibilities: _normalized AST control-flow and module instances_. **/
export type NormalizedAstControlFlow = {
	readonly private_accesses: LineOnly[];
	readonly repeated_branches: LineOnly[];
	readonly module_instances: AstModuleInstance[];
};

/** Responsibilities: _normalized AST module declarations_. **/
export type NormalizedAstModuleDeclarations = {
	readonly module_constant_spans: AstSourceSpan[];
	readonly module_type_spans: AstSourceSpan[];
	readonly module_protocol_spans: AstSourceSpan[];
	readonly python_exports: string[];
	readonly python_callable_count: FunctionCount;
	readonly python_main_guard: boolean;
	readonly docstring_spans: AstSourceSpan[];
	readonly responsibility_targets: AstResponsibilityTarget[];
};

/** Responsibilities: _AST file model_. **/
export type NormalizedAstFile = {
	source: NormalizedAstSource;
	references: NormalizedAstSymbolReferences;
	control_flow: NormalizedAstControlFlow;
	module_declarations: NormalizedAstModuleDeclarations;
};
