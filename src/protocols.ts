import type { PythonAstWorkerContract } from "src/core/python-ast-worker.mjs";
import type { IOContract } from "src/io/protocols";
import type { CallableClassIndex, CallableDefinition, ParsedFile } from "src/metrics/types";
import type { TypeScriptTypeDetails } from "src/model/types";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import type { ResolvedTypeScriptDeclarationKind } from "src/module-resolution/types";
import type { RuleParameters, TypeScriptPropertySide } from "src/types";
import type {
	Assignment,
	AstCallableNodeContract,
	AstClassField,
	AstClassNode,
	AstCodingIssue,
	AstLanguage,
	AstParseIssue,
	AstPythonImport,
	AstResponsibilityTarget,
	AstSourceSpan,
	AstTypeKind,
	AstTypeMemberRecord,
	CallableReferenceIdentity,
	CallbackCounts,
	DirectoryFileSet,
	DuplicateTypeShape,
	GitIgnoreGlobMatchResult,
	ImportedFunction,
	JestSuite,
	LintAnalysisStage,
	LintFileNameContract,
	LintInputFiles,
	LintRunResult,
	LintRunState,
	LintRunStatistics,
	LintSourceRecord,
	LintStageDuration,
	MaxMethodMetricInput,
	NamedLine,
	NamedSymbol,
	NormalizedAstFile,
	ParseLanguage,
	PythonBatchAstOptions,
	PythonSourceAstBatch,
	ReviewAgentRunOptions,
	ReviewAgentSelection,
	ReviewStatus,
	RuleAppender,
	RuleContextData,
	SourceReference,
	SourceReferenceRelation,
	TaskReportingOptions,
	TaskReviewRunResult,
	TestTargetImport,
	TypeScriptAssignmentContext,
	TypeScriptTreeMetadata,
} from "src/types";
import type { ReportViolation } from "src/types";
import type { TaskBatchReplacementOptions, TaskWorkspaceDocument } from "src/types";
import type { LineDepth } from "src/types";
import type { AbsoluteImportCandidate, CacheState } from "src/types";
import type { TaskFileSelection } from "src/model/types/types";
import type { DirectoryFileViolationOptions } from "src/model/types/types";
import type { ViolationCounts } from "src/model/types/types";
import type { RemainingViolationOptions } from "src/model/types/types";
import type { ArchitectureInput } from "src/model/types/types";
import type { StaticKeyCollectionState } from "src/typescript-aliases/callables/types";
import type { QualityCheckRunOptions } from "test-runner/types";
import type ts from "typescript";

export type SourceFileResolver = ReadonlyMap<string, ts.SourceFile>;
export type StringSet = Set<string>;
export type StringSetMap = Map<string, StringSet>;
export type NumberSet = Set<number>;
export type StringNumberSetMap = Map<string, NumberSet>;
export type ReadonlyStringSet = ReadonlySet<string>;
export type ReadonlyStringSetMap = ReadonlyMap<string, ReadonlyStringSet>;
export type StringReadonlySetMap = Map<string, ReadonlyStringSet>;
export type SourceFileDeclarationMap = Map<string, ts.Declaration>;
export type SourceFileDeclarationCache = WeakMap<ts.SourceFile, SourceFileDeclarationMap>;
export type SourceFileStringSetCache = WeakMap<ts.SourceFile, ReadonlyStringSet>;
export type SourceFileCallableList = readonly ts.FunctionLikeDeclaration[];
export type SourceFileCallableMap = ReadonlyMap<string, SourceFileCallableList>;
export type SourceFileCallableCache = WeakMap<ts.SourceFile, SourceFileCallableMap>;
export type ReadonlyStringMap = ReadonlyMap<string, string>;
export type SourceFileReadonlyStringMapCache = WeakMap<ts.SourceFile, ReadonlyStringMap>;
export type StringStringMap = Map<string, string>;
export type StringArrayMap = Map<string, string[]>;
export type StringBooleanMap = Map<string, boolean>;
export type SourceFileBooleanMapCache = WeakMap<ts.SourceFile, StringBooleanMap>;
export type StringSetToStringMapCache = WeakMap<StringSet, StringStringMap>;
export type StringReadonlyMap = Map<string, ReadonlyStringMap>;
export type NodeStringSetMapCache = WeakMap<ts.Node, StringSetMap>;
export type NodeReadonlyStringSetCache = WeakMap<ts.Node, ReadonlyStringSet>;
export type NodeReadonlyStringSetMap = Map<ts.Node, ReadonlyStringSet>;
export type StringAbsoluteImportMap = Map<string, AbsoluteImportCandidate>;
export type AbsoluteImportRootIndex = Map<string, StringAbsoluteImportMap>;
export type AbsoluteImportRootCache = WeakMap<ReadonlyStringSet, AbsoluteImportRootIndex>;
export type PythonImportRootMap = Map<string, readonly string[]>;
export type PythonImportRootCache = WeakMap<ReadonlyStringSet, PythonImportRootMap>;
export type PythonImportPartCache = WeakMap<ReadonlyStringSet, StringSetMap>;
export type PythonDirectoryFilesCache = WeakMap<ReadonlyStringSet, StringArrayMap>;

/** Responsibilities: _Python import file index_. **/
export interface PythonImportFileIndexContract {
	directories(files: ReadonlySet<string>): Map<string, string[]>;
	root_files(root: string, files: ReadonlySet<string>): readonly string[];
	importable_parts(root: string, files: ReadonlySet<string>): Set<string>;
	import_roots(root: string, files: ReadonlySet<string>): readonly string[];
}

/** Responsibilities: _AST property binding resolution_. **/
export interface AstPropertyBindingIndexContract {
	register(source: ts.SourceFile, node: ts.Node): void;
	type(identifier: ts.Identifier, unknown_type: ts.TypeNode): ts.TypeNode;
}

/** Responsibilities: _AST property type resolution_. **/
export interface AstPropertyBindingResolverContract {
	type(identifier: ts.Identifier, unknown_type: ts.TypeNode): ts.TypeNode;
}

/** Responsibilities: _AST property source indexing_. **/
export interface AstPropertySourceIndexContract extends AstPropertyBindingResolverContract {
	declarations_for(source: ts.SourceFile): ReadonlyMap<string, ts.Declaration>;
}

/** Responsibilities: _cache record validity_, _cache identity matching_. **/
export interface LintExecutionCacheRecordSnapshotContract {
	valid(): boolean;
	identity_matches(identity: string): boolean;
}

/** Responsibilities: _source record language identity_, _source record data_. **/
export interface LintSourceRecordContract extends LintSourceRecord {
	typescript(): boolean;
	python(): boolean;
}

/** Responsibilities: _array element resolution_. **/
export type ArrayElementsResolverContract = (initializer: ts.ArrayLiteralExpression) => readonly ts.Expression[];

/** Responsibilities: _expression structure_. **/
export interface TypeScriptCallExpressionInspectorContract {
	direct_value_expression(node: ts.Node): readonly ts.Expression[];
	bind_target(node: ts.CallExpression): readonly ts.Node[];
}

/** Responsibilities: _TypeScript file scanning contract_. **/
export interface TypeScriptFileScannerContract {
	scan(
		file_name: LintFileNameContract,
		text: string,
		ast_file: TypeScriptAstFileContract,
		traversal: TypeScriptAstTraversalContract,
		stage_timer: LintStageTimerContract,
	): ViolationContract[];
	scan_ignored(source: LintSourceRecord, stage_timer: LintStageTimerContract): ViolationContract[];
}

export type CallableReferenceKindContract = "function" | "method";

export type TypeScriptVariableBindingContract = {
	declaration(name: string, reference: ts.Node): ts.Node;
	primitive(name: string, reference: ts.Node): boolean;
};

export type TypeScriptImportedFunctionAliasesContract = {
	imported_function_aliases(source_file: ts.SourceFile): Map<string, ImportedFunction>;
	imported_function_names(imports: ReadonlyMap<string, ImportedFunction>): ReadonlySet<string>;
};

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

/** Responsibilities: _source file discovery_. **/
export interface LintFileDiscoveryContract {
	walk_files_raw(repo_root: string, root: string, ignored_directories: ReadonlySet<string>): string[];
}

/** Responsibilities: _lint input file selection_, _explicit target handling_. **/
export interface LintInputFileSelectorContract {
	input_files(repo_root: string, configured: readonly string[], explicit_files: readonly string[]): LintInputFiles;
}

/** Responsibilities: _complete-cache input discovery_. **/
export interface LintInputDiscoveryContract {
	input_files(repo_root: string, configured: readonly string[]): LintInputFiles;
}

/** Responsibilities: _source availability_, _source text access_. **/
export interface ProjectSourceContentIOContract {
	source_available(file: string): boolean;
	source_text(file: string): string;
}

/** Responsibilities: _project file inventory_. **/
export interface ProjectSourcePathCatalogContract {
	source_paths(root: string, ignored_directories: ReadonlySet<string>): readonly string[];
}

/** Responsibilities: _source snapshot ownership_. **/
export interface ProjectSourceIOContract extends ProjectSourceContentIOContract, ProjectSourcePathCatalogContract {}

/** Responsibilities: _process signal handling_. **/
export interface ProcessSignalContract {
	pid_exists(pid: number): boolean;
	group_exists(pid: number): boolean;
	terminate_group(pid: number): void;
}

/** Responsibilities: _project source snapshot construction_. **/
export interface ProjectSourceSnapshotContract {
	source_paths(inputs: LintInputFiles): readonly string[];
	source_texts(inputs: LintInputFiles): ReadonlyMap<string, string>;
}

/** Responsibilities: _method order validation_. **/
export interface MethodOrderContract {
	append_order_violations(violations: ViolationContract[], file: string, node: AstClassNode): void;
}

/** Responsibilities: _symbol naming validation_. **/
export interface NamingSupportContract {
	append_naming_violations(
		violations: ViolationContract[],
		file: string,
		symbols: NamedSymbol[],
		classes: AstClassNode[],
		type_declarations: NamedLine[],
	): void;
}

/** Responsibilities: _name validation_. **/
export interface NamingValidationContract {
	name_words(name: string): string[];
	valid_name(name: string, kind: string, is_module_constant: boolean, words: string[], visibility: string): boolean;
	append_standard_violation(violations: ViolationContract[], file: string, symbol: NamedSymbol): void;
	numeric_name_violation(file: string, line: number): ViolationContract;
	naming_violation(file: string, line: number, name: string, kind: string, word_count: number): ViolationContract;
}

/** Responsibilities: _source-qualified callable identity resolution_. **/
export interface CallableSourceIdentityGraphContract {
	index_sources(parsed_files: readonly ParsedFile[]): void;
	class_ancestors(identity: string): Set<string>;
	concrete_descendants(class_nodes: CallableClassIndex): ReadonlyStringSetMap;
	visible_type_members(type_name: string, source_file: string): string[];
	class_identities(name: string, source_file: string): string[];
}

/** Responsibilities: _callable import scope resolution_. **/
export interface CallableSourceImportScopeContract {
	imports_for(file: string): ReadonlySet<string>;
	scope_files(file: ParsedFile): ReadonlySet<string>;
}

/** Responsibilities: _Python class singleton collection_. **/
export interface PythonClassVariableSingletonsContract {
	violations(): ViolationContract[];
}

/** Responsibilities: _Python architecture violation collection_. **/
export interface PythonArchitectureContract {
	append_architecture_violations(input: ArchitectureInput): void;
}

/** Responsibilities: _Python assignment violation collection_. **/
export interface PythonHacksContract {
	append_assignment_violations(
		violations: ViolationContract[],
		file: string,
		callables: AstCallableNodeContract[],
	): void;
}

/** Responsibilities: _metric violation collection_. **/
export interface MetricViolationsContract {
	append_depth_violations(violations: ViolationContract[], file: string, accesses: LineDepth[]): void;
}

/** Responsibilities: _cached lint-result retrieval_, _cached lint-result persistence_. **/
export interface LintExecutionCacheContract {
	cached_result(): CacheState<LintRunResult>;
	write(result: LintRunResult): void;
}

/** Responsibilities: _cached global-analysis retrieval_, _cached global-analysis persistence_. **/
export interface GlobalAnalysisCacheContract {
	cached_violations(): CacheState<ViolationContract[]>;
	write(violations: readonly ViolationContract[]): void;
}
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

/** Responsibilities: _callable metric reporting_. **/
export interface CallableMetricsContract {
	append_maximum_length(): void;
	append_callable_metrics(): void;
	append_nesting_depth(): void;
	append_arguments(): void;
}

/** Responsibilities: _class field normalization_. **/
export interface TypeScriptClassMembersContract {
	callback_counts(node: ts.ClassLikeDeclaration): CallbackCounts;
	class_fields(node: ts.ClassLikeDeclaration): AstClassField[];
	interface_fields(node: ts.InterfaceDeclaration): AstClassField[];
	type_alias_fields(node: ts.TypeAliasDeclaration): AstClassField[];
}

/** Responsibilities: _static array index resolution_. **/
export interface TypeScriptStaticArrayIndexValuesContract {
	numeric_index(expression: ts.Expression): number;
	append(
		values: ts.Expression[],
		expression: ts.ElementAccessExpression,
		source: StaticExpressionArrayContract,
		append_source: StaticArraySourceAppenderContract,
	): boolean;
}

/** Responsibilities: _static array source expansion_. **/
export interface StaticArraySourceAppenderContract {
	append(values: ts.Expression[], expression: ts.Expression): boolean;
}

/** Responsibilities: _static array value resolution_. **/
export interface TypeScriptStaticArrayValuesContract {
	append(values: ts.Expression[], expression: ts.Expression): boolean;
	values(expression: ts.Expression): readonly ts.Expression[];
	sequence(expression: ts.Expression): StaticExpressionArrayContract;
}

/** Responsibilities: _recursive static array ownership_, _array source expansion_. **/
export interface StaticArrayExpressionOwnerContract extends TypeScriptStaticArrayValuesContract {}

/** Responsibilities: _structural array value expansion_, _composed expression sequences_. **/
export interface TypeScriptStaticArrayStructureContract {
	append(values: ts.Expression[], expression: ts.Expression, owner: StaticArrayExpressionOwnerContract): boolean;
	sequence(expression: ts.Expression, owner: StaticArrayExpressionOwnerContract): StaticExpressionArrayContract;
}

/** Responsibilities: _lazy static array values_, _indexed expression access_. **/
export interface StaticExpressionArrayContract {
	readonly size: bigint;
	contains(index: bigint): boolean;
	at(index: bigint): ts.Expression;
	slice(start: number): StaticExpressionArrayContract;
	append_to(target: ts.Expression[]): void;
}

/** Responsibilities: _static object source resolution_. **/
export interface TypeScriptStaticObjectSourcesContract {
	append_properties(properties: ts.ObjectLiteralElementLike[], initializer: ts.Expression): boolean;
	append_binding(initializer: ts.Expression, append_branch: StaticObjectBranchAppender): boolean;
	append_source(objects: Map<string, ts.ObjectLiteralExpression>, name: string, initializer: ts.Expression): boolean;
}

/** Responsibilities: _static object value resolution_. **/
export interface TypeScriptStaticObjectValuesContract {
	property_name(node: ts.Node): string;
	append_property_value(
		initializer: ts.ObjectLiteralExpression,
		source_name: string,
		seen: Set<ts.ObjectLiteralExpression>,
		append_value: StaticObjectValueAppender,
	): boolean;
	append_value(name: string, current: ts.Expression): boolean;
	append_object(name: string, current: ts.Expression): boolean;
	property_value(object: ts.ObjectLiteralExpression, source_name: string): string;
}

/** Responsibilities: _Python type rule collection_. **/
export interface PythonTypeRuleCollectorContract {
	append_type_rules(): void;
	append_type_information(): void;
}

/** Responsibilities: _Jest test rule collection_. **/
export interface JestTestRulesContract {
	append_violations(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		resolver: TypeScriptModuleResolverContract,
	): void;
	jest_file(file: string): boolean;
}

/** Responsibilities: _Jest callback extraction_. **/
export interface JestSuiteCollectorContract {
	with_callback(node: ts.CallExpression, consumer: CallableConsumer): void;
	suites(source_file: ts.SourceFile): JestSuite[];
}

/** Responsibilities: _Jest asynchronous completion diagnostics_. **/
export interface JestAsyncCompletionRulesContract {
	append(violations: ViolationContract[], file: string, source_file: ts.SourceFile, tests: ts.CallExpression[]): void;
}

/** Responsibilities: _Jest declaration identity resolution_. **/
export interface JestBindingIndexContract {
	async_binding(identifier: ts.Identifier): boolean;
	module_binding(identifier: ts.Identifier, declarations: ReadonlySet<ts.Declaration>): boolean;
}

/** Responsibilities: _Jest setup rule collection_. **/
export interface JestSetupRulesContract {
	append_duplicate_setup(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void;
	append_fixture_complexity(violations: ViolationContract[], file: string, source_file: ts.SourceFile): void;
}

/** Responsibilities: _pointless assignment rule collection_. **/
export interface PointlessAssignmentsContract {
	append_assignment_violations(violations: ViolationContract[], file: string, source_file: ts.SourceFile): void;
}

/** Responsibilities: _private member rule collection_. **/
export interface PrivateMemberAccessContract {
	append_private_access(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		traversal: TypeScriptAstTraversalContract,
	): void;
}

/** Responsibilities: _TypeScript declaration-prefix rule collection_. **/
export interface TypeScriptScriptDeclarationRulesContract {
	append_indexed_violations(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		declaration_candidates: readonly ts.Node[],
	): void;
}

/** Responsibilities: _TypeScript inline-type rule collection_. **/
export interface TypeScriptInlineRulesContract {
	node_violations(file: string, source_file: ts.SourceFile, node: ts.Node): ViolationContract[];
	append_node(violations: ViolationContract[], file: string, source_file: ts.SourceFile, node: ts.Node): void;
}

/** Responsibilities: _TypeScript type-operation rule collection_. **/
export interface TypeScriptTypeOperationsContract {
	append_node_operation(violations: ViolationContract[], file: string, source_file: ts.SourceFile, node: ts.Node): void;
}

/** Responsibilities: _TypeScript dictionary-return rule collection_. **/
export interface TypeScriptDictionaryReturnsContract {
	dictionary_return_info(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		index: TypeScriptAstNodeCollection,
	): void;
}

/** Responsibilities: _TypeScript repeated-branch rule collection_. **/
export interface TypeScriptRepeatedBranchContract {
	repeated_branch(violations: ViolationContract[], file: string, source_file: ts.SourceFile): void;
}

/** Responsibilities: _TypeScript script-rule service options_. **/
export type TypeScriptScriptRuleOptions = {
	violations: ViolationContract[];
	file: string;
	source_file: ts.SourceFile;
	index: TypeScriptAstNodeCollection;
	traversal: TypeScriptAstTraversalContract;
	stage_timer: LintStageTimerContract;
	module_resolver: TypeScriptModuleResolverContract;
};

/** Responsibilities: _shared TypeScript script-rule services_. **/
export interface TypeScriptScriptRuleServicesContract {
	append_rules(options: TypeScriptScriptRuleOptions): void;
}

/** Responsibilities: _TypeScript singleton rule collection_. **/
export interface TypeScriptSingletonCollectorContract {
	collect(): ViolationContract[];
}

/** Responsibilities: _TypeScript callable node construction_. **/
export interface CallableNodesContract {
	interface_node(node: ts.InterfaceDeclaration): AstClassNode;
	class_method_nodes(node: ts.ClassLikeDeclaration, fallback_name: string): AstCallableNodeContract[];
	variable_callable_nodes(statement: ts.VariableStatement): AstCallableNodeContract[];
	function_declaration_node(statement: ts.FunctionDeclaration): AstCallableNodeContract;
}

/** Responsibilities: _TypeScript class node construction_. **/
export interface TypeScriptClassNodesContract {
	class_nodes(): AstClassNode[];
	interface_nodes(): AstClassNode[];
}

/** Responsibilities: _TypeScript AST metadata construction_. **/
export interface TypeScriptAstMetadataContract {
	normalized(classes: AstClassNode[], functions: AstCallableNodeContract[]): NormalizedAstFile;
}

/** Responsibilities: _TypeScript responsibility targets_. **/
export interface TypeScriptResponsibilityTargetsContract {
	collect(): AstResponsibilityTarget[];
}

/** Responsibilities: _private member names_. **/
export interface PrivateMemberDeclarationNamesContract {
	name(member: ts.ClassElement, source_file: ts.SourceFile): string;
	names(member: ts.ClassElement, source_file: ts.SourceFile): string[];
}

/** Responsibilities: _object destructured aliases_. **/
export interface TypeScriptDestructuredAliasesContract {
	register_sources(declarations: readonly ts.VariableDeclaration[]): void;
	object_aliases(declaration: ts.VariableDeclaration): boolean;
}

/** Responsibilities: _array destructured aliases_. **/
export interface TypeScriptArrayDestructuredAliasesContract {
	register_sources(declarations: readonly ts.VariableDeclaration[]): void;
	array_aliases(declaration: ts.VariableDeclaration): boolean;
}

/** Responsibilities: _result ownership_. **/
export interface TypeScriptCallReturnAnalysisContract {
	reference_owner(type: ts.TypeNode): string;
}

/** Responsibilities: _result values_. **/
export interface TypeScriptCallReturnsContract {
	initialize(): void;
	owner_for(name: string, owner: string, side: TypeScriptPropertySide): string;
}

/** Responsibilities: _TypeScript callable reference identity_. **/
export interface TypeScriptReferenceIdentityContract {
	member_name(expression: ts.AccessExpression): string;
	method_reference(expression: ts.AccessExpression, owner: string): CallableReferenceIdentity;
}

/** Responsibilities: _TypeScript instance alias collection_. **/
export interface TypeScriptInstanceAliasCollectorContract {
	collect_variables(): void;
	collect_parameters(): void;
	collect_bindings(): void;
}

/** Responsibilities: _unnecessary undefined-check rule collection_. **/
export interface UnnecessaryUndefinedCheckContract {
	append(node: ts.Node): void;
}

/** Responsibilities: _undefined check candidate classification_. **/
export interface UndefinedCheckCandidateContract {
	matches(node: ts.Node): boolean;
}

/** Responsibilities: _duplicate type-shape collection_. **/
export interface DuplicateTypeShapesContract {
	typescript(source_file: ts.SourceFile): DuplicateTypeShape[];
	python(classes: readonly AstClassNode[]): DuplicateTypeShape[];
}

/** Responsibilities: _member variable aliases_. **/
export interface TypeScriptMemberVariableAliasesContract {
	append_member(aliases: StringSetMap, node: ts.VariableDeclaration): boolean;
	append(aliases: StringSetMap, node: ts.VariableDeclaration): boolean;
}

/** Responsibilities: _static array values_. **/
export interface TypeScriptStaticArrayValuesContract {
	append(values: ts.Expression[], expression: ts.Expression): boolean;
	values(expression: ts.Expression): readonly ts.Expression[];
	sequence(expression: ts.Expression): StaticExpressionArrayContract;
}
export type TypeScriptNodeVisitor = (body: ts.Node) => void;
export type ModulePathResolver = (file: string, specifier: string) => string;
export type NestedFactoryExpressionsResolver = (
	binding: ts.ArrayBindingPattern,
	initializer: ts.Expression,
	name: string,
) => ReadonlyMap<string, ts.FunctionLikeDeclarationBase>;
export type ObjectSourceVisitor = (source: ts.ObjectLiteralExpression) => void;
export type ArraySourceResolver = (binding: ts.ArrayBindingPattern, value: ts.Expression, name: string) => string;
export type ExpressionVisitor = (value: ts.Expression) => void;

/** Responsibilities: _Python import source resolution_. **/
export interface PythonImportResolutionContract {
	collect_project_imports(
		file: string,
		python_imports: AstPythonImport[],
		root: string,
		files: ReadonlySet<string>,
	): Map<string, ImportedFunction>;
}

/** Responsibilities: _TypeScript node type rules_. **/
export interface TypeScriptNodeTypeRulesContract {
	append_type_rules(node: ts.Node, context: RuleContextData): void;
}

/** Responsibilities: _TypeScript class-node rule collection_. **/
export interface TypeScriptClassNodeRulesContract {
	append(node: ts.Node, context: RuleContextData): void;
}
/** Responsibilities: _assignment predicate classification_. **/
export interface TypeScriptAssignmentPredicatesContract {
	field_assignment(node: ts.Node, context: TypeScriptAssignmentContext): boolean;
	primitive_assignment(node: ts.ConditionalExpression): boolean;
}
/** Responsibilities: _assignment value classification_. **/
export interface TypeScriptAssignmentValuePredicatesContract {
	operand_allowed(left: ts.Expression, right: ts.Expression, source_file: ts.SourceFile): boolean;
	conditional_assignment(node: ts.Node): boolean;
	logical_assignment(node: ts.Node): boolean;
	primitive_expression(expression: ts.Expression): boolean;
	enum_member_default(expression: ts.Expression): boolean;
}
/** Responsibilities: _proxy rule classification_. **/
export interface ProxyRulesContract {
	proxy_callable(node: ts.Node): boolean;
	proxy_lambda(node: ts.Node): boolean;
}
/** Responsibilities: _value rule classification_. **/
export interface ValueRulesContract {
	append_value_rules(node: ts.Node, test_file: boolean, append_rule: RuleAppender): void;
	repeated_typeof(node: ts.TypeOfExpression): boolean;
	typed_primitive(expression: ts.Expression, source_file: ts.SourceFile): boolean;
	dynamic_class(node: ts.Node): boolean;
}
/** Responsibilities: _array state rule classification_. **/
export interface TypeScriptArrayStateRulesContract {
	array_access(node: ts.Node, source_file: ts.SourceFile): boolean;
	append(node: ts.Node, context: RuleContextData): void;
}
/** Responsibilities: _rest union rule classification_. **/
export interface RestUnionContractRuleContract {
	rest_parameter(node: ts.Node): boolean;
	append_rule(node: ts.Node, context: RuleContextData): void;
}
/** Responsibilities: _conditional rule aggregation_. **/
export interface TypeScriptConditionalRulesContract {
	append(node: ts.Node, source_file: ts.SourceFile, append_rule: RuleAppender): void;
	append_if_block(node: ts.Node, append_rule: RuleAppender): void;
}

/** Responsibilities: _file-analysis cache retrieval_, _file-analysis cache persistence_, _file-analysis cache cleanup_. **/
export interface FileAnalysisCacheContract {
	cached_violations(file: string, text: string, ignored: boolean): CacheState<ViolationContract[]>;
	write(file: string, text: string, ignored: boolean, violations: readonly ViolationContract[]): void;
	clean_unused_records(records: readonly LintSourceRecord[]): void;
}

/** Responsibilities: _source-qualified callable symbol lookup_. **/
export interface CallableSymbolIndexContract {
	types_named(name: string, source_file: string): AstTypeMemberRecord[];
	type_members(type_name: string, source_file: string): string[];
	type_member_names(type_name: string, source_file: string): ReadonlySet<string>;
}
/** Responsibilities: _terminal branch classification_. **/
export interface TypeScriptTerminalBranchesContract {
	terminal_statement(statement: ts.Statement): boolean;
	early_exit(node: ts.IfStatement): boolean;
}
/** Responsibilities: _union boundary rule aggregation_. **/
export interface TypeScriptBoundaryRuleAppenderContract {
	append(node: ts.Node, context: RuleContextData): void;
	union_rules_apply(node: ts.Node): boolean;
}
/** Responsibilities: _TypeScript boolean precedence classification_. **/
export interface TypeScriptOperatorPrecedenceContract {
	mixed_boolean_operator(node: ts.Node): boolean;
}
/** Responsibilities: _proxy expression resolution_. **/
export interface TypeScriptProxyExpressionsContract {
	property_chain(node: ts.Node): string[];
	contains_property(node: ts.Node, property: string): boolean;
}
/** Responsibilities: _callable body metrics_. **/
export interface CallableBodyMetricsContract {
	characters(node: ts.SignatureDeclarationBase): number;
	lines(node: ts.SignatureDeclarationBase): number;
	sloc(node: ts.SignatureDeclarationBase): number;
	control_flow_depth(node: ts.SignatureDeclarationBase): number;
	exception_only(node: ts.SignatureDeclarationBase): boolean;
}

/** Responsibilities: _imported callable owners_. **/
export interface TypeScriptImportedCallOwnersContract {
	collect(): ReadonlyMap<string, string>;
	append_to(owners: Map<string, string>): void;
}

/** Responsibilities: _TypeScript class-field rule collection_. **/
export interface TypeScriptClassFieldRulesContract {
	missing_visibility(node: ts.Node, file: string): boolean;
	mutable_field(node: ts.Node, file: string): boolean;
	collect_fields(files: string[], repo_root: string): ViolationContract[];
	context_fields(files: string[], repo_root: string, context: LintProjectContextContract): ViolationContract[];
}

/** Responsibilities: _TypeScript type-node classification_. **/
export interface TypeScriptTypeNodeContract {
	primitive(): boolean;
	details(): TypeScriptTypeDetails;
}

/** Responsibilities: _TypeScript variable declaration lookup_. **/
export interface TypeScriptVariableDeclarationIndexContract {
	declarations(source_file: ts.SourceFile, name: string): readonly ts.VariableDeclaration[];
	declarations_present(source_file: ts.SourceFile, name: string): boolean;
}

/** Responsibilities: _TypeScript node rule collection_. **/
export interface TypeScriptNodeRulesContract {
	append_node_rules(node: ts.Node, inside_constructor: boolean, context: RuleContextData): void;
	append_mutable_rule(node: ts.Node, inside_constructor: boolean, context: RuleContextData): void;
}

/** Responsibilities: _TypeScript expression alias collection_. **/
export interface TypeScriptExpressionAliasCollectorContract {
	append_scope_aliases(
		aliases: Set<string>,
		node: ts.Node,
		root: ts.Node,
		object_aliases: TypeScriptObjectAliasesContract,
	): boolean;
	collect(scope: ts.Node): ReadonlySet<string>;
}

/** Responsibilities: _TypeScript member binding collection_. **/
export interface TypeScriptMemberBindingContract {
	member_name(expression: ts.Expression, source: ts.Node): string;
	collect(scope: ts.Node): StringSetMap;
}

/** Responsibilities: _static array sources_. **/
export interface TypeScriptStaticArraySourcesContract {
	append_source(node: ts.VariableDeclaration): boolean;
	append_assignment(name: string, expression: ts.Expression): boolean;
	append_rest(name: string, values: StaticExpressionArrayContract): boolean;
}

/** Responsibilities: _static array bindings_. **/
export interface TypeScriptStaticArrayExpressionBindingsContract {
	append_binding(values: Map<string, string>, node: ts.VariableDeclaration): boolean;
	append_assignment(node: ts.BinaryExpression): boolean;
	append(values: Map<string, string>, node: ts.VariableDeclaration): boolean;
}

export type QualityCheckContract = {
	label: string;
	command: string;
	args: readonly string[];
	environment: NodeJS.ProcessEnv;
	supports_review_options: boolean;
	supports_review_agent: boolean;
};

export type QualityCheckDefinitionsContract = {
	all_checks(): QualityCheckContract[];
};

export type QualityCheckProcessContract = {
	run(options: QualityCheckRunOptions): void;
	available_checks(): boolean;
};

/** Responsibilities: _static expression bindings_. **/
export interface TypeScriptStaticExpressionBindingsContract {
	append_source(node: ts.VariableDeclaration): boolean;
	append(values: Map<string, string>, node: ts.VariableDeclaration): boolean;
	append_assignment(node: ts.BinaryExpression): boolean;
}

/** Responsibilities: _TypeScript reference ownership resolution_. **/
export interface TypeScriptReferenceOwnershipContract {
	call_owner(expression: ts.Expression, current_owner: string): string;
	property_owner(expression: ts.PropertyAccessExpression, current_owner: string): string;
	function_reference(expression: ts.Identifier): CallableReferenceIdentity;
	method_reference(expression: ts.AccessExpression, current_owner: string): CallableReferenceIdentity;
	method_owner(expression: ts.AccessExpression, current_owner: string): string;
}

/** Responsibilities: _AST model normalization_. **/
export interface AstModelContract {
	mark_external_bases(classes: AstClassNode[], project_class_names: ReadonlySet<string>): void;
	empty_ast_file(language: AstLanguage): NormalizedAstFile;
}
/** Responsibilities: _class metadata exposure_. **/
export interface ClassNodeContract {
	type_contract(): boolean;
	protocol(): boolean;
	exception(): boolean;
}
/** Responsibilities: _persistent AST cache operations_. **/
export interface AstDiskCacheContract {
	clean_unused_records(): void;
	content(source_file: string, source_text: string): AstCacheEntryContract;
	write(source_file: string, source_text: string, ast: NormalizedAstFile): void;
}
/** Responsibilities: _analysis identity hashing_. **/
export interface ProjectAnalysisIdentityContract {
	analyzer(): string;
	content(value: string): string;
	context(records: readonly LintSourceRecord[]): string;
	directory_context(root: string): string;
	selection(files: ReadonlySet<string>, ignored_files: ReadonlySet<string>, entry_files: ReadonlySet<string>): string;
}
/** Responsibilities: _source-record AST cache operations_. **/
export interface ContextSourceRecordCacheContract {
	clean(): void;
	cached_asts(
		files: readonly string[],
		texts: ReadonlyMap<string, string>,
		stage_timer: LintStageTimerContract,
	): Map<string, NormalizedAstFile>;
	write(
		files: readonly string[],
		texts: ReadonlyMap<string, string>,
		records: readonly LintSourceRecord[],
		cached: ReadonlyMap<string, NormalizedAstFile>,
		stage_timer: LintStageTimerContract,
	): LintSourceRecord[];
}
/** Responsibilities: _cached AST state contract_, _language compatibility_. **/
export interface AstCacheEntryContract {
	present(): boolean;
	value(): NormalizedAstFile;
	complete(): boolean;
	should_reparse(): boolean;
	supports_language(language: AstLanguage): boolean;
}
/** Responsibilities: _Git ignored path filtering_. **/
export interface GitIgnoredPathsContract {
	filter(files: readonly string[]): string[];
}

/** Responsibilities: _bounded Gitignore glob matching_. **/
export interface GitIgnoreGlobTokenContract {
	advance(candidate: string, index: number, current_row: readonly boolean[], next_row: readonly boolean[]): boolean;
}

/** Responsibilities: _Gitignore glob matching_. **/
export interface GitIgnoreGlobMatcherContract {
	match_candidate(candidate: string): GitIgnoreGlobMatchResult;
	match_segments(candidate: string): GitIgnoreGlobMatchResult;
}

/** Responsibilities: _boolean declaration lookup_. **/
export interface TypeScriptBooleanDeclarationIndexContract {
	readonly boolean_properties: ReadonlySet<string>;
	readonly boolean_callables: ReadonlySet<string>;
	append(source_file: ts.SourceFile): void;
}

/** Responsibilities: _overload sibling name indexing_. **/
export interface TypeScriptOverloadSiblingNamesContract {
	append(node: ts.Node): void;
	function_declaration_count(name: string): number;
	implemented_method_count(name: string): number;
	interface_method_count(name: string): number;
}

/** Responsibilities: _lint stage analysis coordination_. **/
export interface LintRunAnalysisContract {
	collect_directory(state: LintRunState): ViolationContract[];
	collect_file(state: LintRunState, stage_timer: LintStageTimerContract): ViolationContract[];
	collect_global(stage: LintAnalysisStage): ViolationContract[];
	collect(stage: LintAnalysisStage): LintRunResult;
}

/** Responsibilities: _Gitignore configuration paths_. **/
export interface ParsedConfigurationFilesContract extends ReadonlySet<string> {
	add(file: string): void;
}

/** Responsibilities: _violation priority aggregation_. **/
export interface ViolationSummaryContract {
	counts(): ViolationCounts;
	failures(): boolean;
}
export type BindingAliasAppender = (binding: ts.BindingName, initializer: ts.Expression) => boolean;
export type ExpressionNormalizer = (expression: ts.Expression) => ts.Expression;
export type AliasAppender = (name: string, initializer: ts.Expression) => boolean;
export type MemberAliasAppender = (aliases: StringSetMap, name: string, property: string) => boolean;
export type MemberValueAppendRequest = {
	aliases: StringSetMap;
	name: string;
	initializer: ts.Expression;
	node: ts.Node;
};
export type MemberValueAppender = (request: MemberValueAppendRequest) => boolean;
export type ExpressionUnwrapper = (expression: ts.Expression) => ts.Expression;
export type StaticObjectBranchAppender = (expression: ts.Expression) => boolean;
export type StaticObjectValueAppender = (value: ts.Expression) => boolean;
export type PythonAstBatchParser = (texts: readonly string[]) => NormalizedAstFile[];
export type SourceLineResolver = (position: number) => number;
export type TypeScriptMetadataNodeVisitor = (node: ts.Node, owner: string) => void;

/** Responsibilities: _TypeScript tree metadata collection_. **/
export interface TypeScriptTreeMetadataCollectorContract {
	collect(line_for: SourceLineResolver, on_node: TypeScriptMetadataNodeVisitor): TypeScriptTreeMetadata;
}
export type Operation<T> = () => T;
export type AsyncOperation<T> = () => Promise<T>;
export type SpreadValueAppender = (expression: ts.Expression) => boolean;
export type StaticValueResolver = (expression: ts.Expression, node: ts.Node) => string;
export type MapValueAppender = (values: Map<string, string>, name: string, initializer: ts.Expression) => boolean;
export type NodeBodyResolver<T> = (body: ts.Node) => T;
export type StatementPredicate = (statement: ts.Statement) => boolean;
export type NameRelationsResolver = (name: string) => string[];
export type ObjectSourceAppender = (expression: ts.Expression, visitor: ObjectSourceVisitor) => void;
export type CallableConsumer = (callback: ts.FunctionLikeDeclaration) => void;
export type ArrayValuesVisitor = (values: readonly ts.Expression[]) => void;

/** Responsibilities: _define diagnostic violation contract_. **/
export type ViolationRecord = {
	readonly file: string;
	readonly line: number;
	readonly message: string;
	readonly hint: string;
	readonly rule_id: string;
	readonly priority: number;
	details(): ReportViolation;
	with_line(line: number): ViolationContract;
};

/** Responsibilities: _diagnostic violation contract_. **/
export interface ViolationContract extends ViolationRecord {
	with_line(line: number): ViolationContract;
}

/** Responsibilities: _define diagnostic rule contract_. **/
export interface RuleContract {
	supports_file(file: string): boolean;
	violation(file: string, line: number, parameters: RuleParameters): ViolationContract;
}

/** Responsibilities: _text violation discovery contract_. **/
export interface TextFileDiscoveryContract {
	violations(
		repo_root: string,
		configured_ignored: ReadonlySet<string>,
		source_texts: ReadonlyMap<string, string>,
	): ViolationContract[];
	violations_for_files(
		files: readonly string[],
		repo_root: string,
		source_texts: ReadonlyMap<string, string>,
	): ViolationContract[];
	files_unfiltered(repo_root: string, configured_ignored: ReadonlySet<string>): string[];
}

/** Responsibilities: _source declaration names contract_. **/
export interface SourceNamesContract {
	names_for_source(source: LintSourceRecord, include_type_declarations: boolean): string[];
}

/** Responsibilities: _boolean expression classification contract_. **/
export interface BooleanExpressionContract {
	boolean_expression(node: ts.Expression, source_file: ts.SourceFile): boolean;
	logical_operator(node: ts.BinaryExpression): boolean;
	boolean_call(node: ts.CallExpression, source_file: ts.SourceFile): boolean;
}

/** Responsibilities: _nullable type classification contract_. **/
export interface NullableTypeRulesContract {
	nullable_type(node: ts.Node): boolean;
}

/** Responsibilities: _composite state rules_. **/
export interface CompositeStateTypeRulesContract {
	violation(node: ts.Node): boolean;
}

/** Responsibilities: _expression name resolution_. **/
export interface ExpressionNamesContract {
	unwrap_transparent_expression(expression: ts.Expression): ts.Expression;
	static_property_name(node: ts.Node): string;
	static_binding_name(element: ts.BindingElement): string;
}

/** Responsibilities: _binding alias collection_. **/
export interface BindingAliasesContract {
	append_binding_aliases(
		aliases: Set<string>,
		binding: ts.BindingName,
		initializer: ts.Expression,
		normalize_initializer: ExpressionNormalizer,
		append_alias: AliasAppender,
	): boolean;
}

/** Responsibilities: _alias map_. **/
export interface CallAliasesContract {
	names(source_file: ts.SourceFile): ReadonlyMap<string, string>;
	call_name(call: ts.CallExpression): string;
}

/** Responsibilities: _array state inspection_. **/
export interface ArrayStateInspectorContract {
	single_item_access(node: ts.ElementAccessExpression, source_file: ts.SourceFile): boolean;
	single_item_method(node: ts.CallExpression, source_file: ts.SourceFile): boolean;
}

/** Responsibilities: _proxy state_. **/
export interface ProxyCallContract {
	proxy_call(node: ts.Node): ts.Node[];
	supports_target_expression(expression: ts.Expression): boolean;
}

/** Responsibilities: _TypeScript test-node rules contract_. **/
export interface TypeScriptTestNodeRulesContract {
	test_node(node: ts.Node): boolean;
	append_rules(node: ts.Node, context: RuleContextData): void;
}

/** Responsibilities: _TypeScript structural rules contract_. **/
export interface TypeScriptStructuralRulesContract {
	append(node: ts.Node, context: RuleContextData): void;
	append_type_rules(node: ts.Node, context: RuleContextData): void;
}

/** Responsibilities: _Jest test-shape diagnostics contract_. **/
export interface JestTestShapeViolationsContract {
	shape_diagnostics(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void;
	result_diagnostics(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void;
	assertion_diagnostics(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void;
}

/** Responsibilities: _dynamic runtime usage contract_. **/
export interface DynamicRuntimeUsageContract {
	append_candidate_rule(node: ts.Node, context: RuleContextData): void;
}

/** Responsibilities: _dynamic runtime member contract_. **/
export interface DynamicRuntimeMembersContract {
	matches(node: ts.Node): boolean;
	call(node: ts.CallExpression): boolean;
	construct(node: ts.NewExpression): boolean;
}

/** Responsibilities: _Jest test-size contract_. **/
export interface JestTestSizeContract {
	body(source_file: ts.SourceFile, bodies: ts.Block[]): number;
	test_body(body: ts.ConciseBody): number;
	suite(source_file: ts.SourceFile, suite: JestSuite): number;
}

/** Responsibilities: _Jest test-shape rule contract_. **/
export interface JestTestShapeRuleContract {
	non_arrow_lines(source_file: ts.SourceFile, tests: ts.CallExpression[]): number[];
	missing_expect_lines(source_file: ts.SourceFile, tests: ts.CallExpression[]): number[];
}

/** Responsibilities: _Jest assertion classification_. **/
export interface JestTestAssertionContract {
	shape_test_lines(source_file: ts.SourceFile, tests: ts.CallExpression[]): number[];
	exception_test_lines(source_file: ts.SourceFile, tests: ts.CallExpression[]): number[];
}

/** Responsibilities: _Jest assertion analysis_. **/
export interface JestAssertionAnalysisContract {
	expectation_lines(source_file: ts.SourceFile, tests: ts.CallExpression[], limit: number): number[];
	collect_assertions(node: ts.Node): ts.CallExpression[];
	shape_only(assertions: ts.CallExpression[]): boolean;
	exception_only(assertions: ts.CallExpression[]): boolean;
}

/** Responsibilities: _TypeScript declaration indexing_. **/
export interface TypeScriptDeclarationIndexContract {
	modifier_present(statement: ts.Statement, kind: ts.SyntaxKind): boolean;
	declarations_for(source_file: ts.SourceFile, name: string): readonly ts.Statement[];
	default_declarations(source_file: ts.SourceFile): readonly ts.Statement[];
	export_assignments(source_file: ts.SourceFile): readonly ts.ExportAssignment[];
	symbol_kind(source_file: ts.SourceFile, name: string): ResolvedTypeScriptDeclarationKind;
}

/** Responsibilities: _Jest assertion matcher contract_. **/
export interface JestAssertionMatcherContract {
	shape_assertion(node: ts.CallExpression): boolean;
	exception_assertion(node: ts.CallExpression): boolean;
}

/** Responsibilities: _object value rules contract_. **/
export interface ObjectValueRulesContract {
	object_string(node: ts.Node): boolean;
	object_assign(node: ts.Node): boolean;
	object_method(node: ts.Node): boolean;
}

/** Responsibilities: _typed object callable aliases_. **/
export interface TypeScriptObjectCallableAliasesContract {
	contains(expression: ts.Expression, node: ts.Node): boolean;
}

/** Responsibilities: _typed callable bindings_. **/
export interface TypeScriptContractBindingsContract {
	append(interfaces: StringSetMap, node: ts.Node): boolean;
}

/** Responsibilities: _typed callable binding contract_. **/
export interface TypeScriptTypedCallableBindingsContract {
	interface_declaration(node: ts.InterfaceDeclaration): void;
	type_alias_declaration(node: ts.TypeAliasDeclaration): void;
	class_declaration(node: ts.ClassDeclaration): void;
	variable(objects: StringSetMap, interfaces: StringSetMap, node: ts.VariableDeclaration): void;
}

/** Responsibilities: _dynamic object member aliases_. **/
export interface DynamicObjectMemberAliasesContract {
	member_name(expression: ts.Expression): string;
	receiver(expression: ts.Expression, source: ts.Node): boolean;
	member(expression: ts.Expression, source: ts.Node, member_name: string): boolean;
}

/** Responsibilities: _TypeScript member alias resolution_. **/
export interface TypeScriptMemberAliasesContract {
	member(expression: ts.Expression, node: ts.Node): boolean;
	property(expression: ts.Expression, node: ts.Node, name: string): boolean;
}

/** Responsibilities: _callable alias name resolution_. **/
export interface TypeScriptCallableAliasesContract {
	names(node: ts.Node): ReadonlySet<string>;
	contains(expression: ts.Expression, node: ts.Node): boolean;
}

/** Responsibilities: _class design metrics_, _class size metrics_. **/
export interface ClassStructureReporterContract {
	report_design(): void;
	report_sizes(): void;
	report_max_sizes(): void;
	append_interface_limit(): void;
}

/** Responsibilities: _static array key contract_. **/
export interface TypeScriptStaticArrayKeysContract {
	value(expression: ts.Expression, source_file: ts.SourceFile): string;
	expressions(expression: ts.Expression, source_file: ts.SourceFile): readonly ts.Expression[];
}

/** Responsibilities: _static key alias contract_. **/
export interface TypeScriptStaticKeyAliasesContract {
	value(expression: ts.Expression, node: ts.Node): string;
	object_property(expression: ts.Expression, node: ts.Node): string;
}

/** Responsibilities: _static key state contract_. **/
export interface TypeScriptStaticKeyStateContract {
	collect(scope: ts.Node): StaticKeyCollectionState;
	values(scope: ts.Node): ReadonlyMap<string, string>;
}

/** Responsibilities: _static object binding contract_. **/
export interface TypeScriptStaticObjectBindingsContract {
	append(
		values: Map<string, string>,
		objects: Map<string, ts.ObjectLiteralExpression>,
		node: ts.VariableDeclaration,
	): boolean;
	append_assignment(node: ts.BinaryExpression): boolean;
}

/** Responsibilities: _callable type property contract_. **/
export interface TypeScriptCallableTypePropertiesContract {
	property_name(name: ts.PropertyName): string;
	object_properties(type: ts.TypeLiteralNode): Set<string>;
	interface_properties(node: ts.InterfaceDeclaration): Set<string>;
	class_properties(node: ts.ClassDeclaration): Set<string>;
}

/** Responsibilities: _pointless expression extraction contract_. **/
export interface PointlessExpressionContract {
	binding_name(name: ts.BindingName): string;
	returned_names_from(statement: ts.Statement): string[];
}

/** Responsibilities: _assignment analysis contract_. **/
export interface TypeScriptAssignmentAnalysisContract {
	assignment_value(statement: ts.Statement, source_file: ts.SourceFile): Assignment[];
	pointless_assignment(candidates: Assignment[], returned_name: string): boolean;
}

/** Responsibilities: _static expression operation resolution_. **/
export interface StaticExpressionOperationsContract {
	unwrapped(expression: ts.Expression): ts.Expression;
	append(values: Map<string, string>, name: string, initializer: ts.Expression): boolean;
	literal(values: ReadonlyMap<string, string>, expression: ts.Expression): string;
}
/** Responsibilities: _static expression value resolution_. **/
export interface StaticExpressionValuesContract {
	value(expression: ts.Expression, node: ts.Node): string;
}

/** Responsibilities: _static array method resolution_. **/
export interface StaticArrayMethodsContract {
	append(values: ts.Expression[], expression: ts.Expression): boolean;
	matches_array_from(expression: ts.CallExpression): boolean;
}

/** Responsibilities: _leading underscore naming contract_. **/
export interface LeadingUnderscoreNamingContract {
	append_declaration_violation(violations: ViolationContract[], file: string, declaration: NamedLine): boolean;
	allowed(symbol: NamedSymbol): boolean;
	violation_for(file: string, line: number, label: string, name: string): ViolationContract;
}

/** Responsibilities: _TypeScript reexport collection contract_. **/
export interface TypeScriptReexportsContract {
	append(violations: ViolationContract[], file: string, source_file: ts.SourceFile): void;
}

/** Responsibilities: _define project source statistics_. **/
export interface LintProjectContextContract {
	source_record(file: string): LintSourceRecord;
	files(): readonly LintSourceRecord[];
	statistics(): LintRunStatistics;
	readonly source_io: ProjectSourceIOContract;
}

/** Responsibilities: _property method ownership_. **/
export interface PropertyOwnerCallbacksContract {
	call_owner(expression: ts.Expression, owner: string): string;
	method_owner(expression: ts.AccessExpression, owner: string): string;
}

/** Responsibilities: _Python AST batch parsing_. **/
export type PythonAstDataOptions = {
	worker: PythonAstWorkerContract;
	analysis_identity: ProjectAnalysisIdentityContract;
	split_batch_enabled: boolean;
	file_io: IOContract;
};

/** Responsibilities: _Python AST batch parsing_. **/
export interface PythonAstDataContract {
	batch_ast(options: PythonBatchAstOptions): NormalizedAstFile[];
	source_ast(text: string): NormalizedAstFile;
	begin_batch_ast?(options: PythonBatchAstOptions): string;
	complete_batch_ast?(batch_id: string): NormalizedAstFile[];
}

/** Responsibilities: _Python source batch lifecycle_. **/
export interface PythonSourceFilesContract {
	begin_source_ast(stage_timer: LintStageTimerContract, stage_prefix: string): PythonSourceAstBatch;
	complete_source_ast(batch: PythonSourceAstBatch): ReadonlyMap<string, NormalizedAstFile>;
	source_ast(stage_timer: LintStageTimerContract, stage_prefix: string): ReadonlyMap<string, NormalizedAstFile>;
}

/** Responsibilities: _lint stage measurement_. **/
export interface LintStageTimerContract {
	add_duration(stage_name: string, elapsed: number): void;
	measure<T>(stage_name: string, operation: Operation<T>): T;
	measure_async<T>(stage_name: string, operation: AsyncOperation<T>): Promise<T>;
	durations(): readonly LintStageDuration[];
	format(): string;
}

/** Responsibilities: _diagnostic task formatting_. **/
export interface TaskReportingFormatContract {
	format(violations: readonly ReportViolation[], options: TaskReportingOptions): string;
}

/** Responsibilities: _diagnostic task reporting_. **/
export interface TaskReportingContract extends TaskReportingFormatContract {
	review_requested(violations: readonly ReportViolation[]): boolean;
	review_status(): ReviewStatus;
	run_review_agent(selection: ReviewAgentSelection, options: ReviewAgentRunOptions): Promise<TaskReviewRunResult>;
}

/** Responsibilities: _task reporting IO_, _rule-document source injection_. **/
export type TaskReportingDependencies = {
	file_io: IOContract;
	documentation: TaskRuleDocumentationContract;
};

/** Responsibilities: _TypeScript reference context_. **/
export interface TypeScriptReferenceContextContract {
	function_reference(expression: ts.Identifier): CallableReferenceIdentity;
	method_reference(expression: ts.AccessExpression, current_owner: string): CallableReferenceIdentity;
	method_owner(expression: ts.AccessExpression, current_owner: string): string;
}

/** Responsibilities: _AST traversal node data_. **/
export type TypeScriptAstTraversalNode = {
	node: ts.Node;
	inside_constructor: boolean;
	owner: string;
	function_owner: ts.Node;
};

export type TypeScriptAstTraversalVisitor = (node: ts.Node, inside_constructor: boolean, owner: string) => void;
export type TypeScriptFunctionOwnerVisitor = (node: ts.Node, owner: ts.Node) => void;

/** Responsibilities: _AST traversal access_. **/
export interface TypeScriptAstTraversalContract {
	visit(visitor: TypeScriptAstTraversalVisitor): void;
	visit_children(visitor: TypeScriptAstTraversalVisitor): void;
	visit_function_owners(visitor: TypeScriptFunctionOwnerVisitor): void;
}

/** Responsibilities: _AST file access_, _normalization_, _traversal reuse_. **/
export interface TypeScriptAstFileContract {
	source_file_node(): ts.SourceFile;
	normalized(): NormalizedAstFile;
	reference_normalization(cached: NormalizedAstFile): NormalizedAstFile;
}

/** Responsibilities: _TypeScript rule-tree traversal_, _constructor state propagation_. **/
export interface TypeScriptRuleTreeTraversalContract {
	append_root_children(context: RuleContextData): void;
	append_nested_children(node: ts.Node, inside_constructor: boolean, context: RuleContextData): void;
}

/** Responsibilities: _undefined-check node rule application_. **/
export interface UndefinedCheckRulesContract {
	append(node: ts.Node): void;
}

/** Responsibilities: _TypeScript AST node index_. **/
export interface TypeScriptAstNodeIndexContract {
	collect(): TypeScriptAstNodeCollection;
}

export type TypeScriptAstNodeCollection = {
	type_aliases: readonly ts.TypeAliasDeclaration[];
	return_statements: readonly ts.ReturnStatement[];
	function_like: readonly ts.SignatureDeclaration[];
	declaration_candidates: readonly ts.Node[];
};

/** Responsibilities: _task workspace operations_. **/
export interface TaskWorkspaceDocumentsContract {
	write_document(document: TaskWorkspaceDocument, content: string): void;
	write_performance(content: string): void;
	path_for_document(document: TaskWorkspaceDocument): string;
	rule_document_path(rule_id: string): string;
}

/** Responsibilities: _task batch replacement_. **/
export interface TaskBatchReplacementContract {
	replace(options: TaskBatchReplacementOptions): void;
}

/** Responsibilities: _task workspace operations_. **/
export interface TaskWorkspaceContract {
	clear_batch(): void;
	prepare_review(): void;
}

/** Responsibilities: _task rule documentation operations_. **/
export interface TaskRuleDocumentationContract {
	validate_rule_documents(): void;
	copy_rule_documents(rule_ids: readonly string[], documents: TaskWorkspaceDocumentsContract): void;
	stage_rule_docs(rule_ids: readonly string[], directory: string, documents: TaskWorkspaceDocumentsContract): void;
}

/** Responsibilities: _task review documentation operations_. **/
export interface TaskReviewDocumentationContract {
	validate_review_documents(): void;
	agent_instruction(review_path: string): string;
}

/** Responsibilities: _task review operations_. **/
export interface TaskReviewContract {
	files(): string[];
	line_count(file: string): number;
	text(file: string): string;
	primary_instruction(): string;
	completed(): boolean;
}

/** Responsibilities: _task review-agent execution_. **/
export interface TaskReviewAgentContract {
	findings_present(): boolean;
	run_parallel(selection: ReviewAgentSelection, options: ReviewAgentRunOptions): Promise<TaskReviewRunResult>;
}

/** Responsibilities: _task violation file selection_. **/
export interface TaskFileSelectorContract {
	select_top_category(violations: readonly ReportViolation[], batch_size: number): TaskFileSelection;
	select_all(violations: readonly ReportViolation[], batch_size: number): TaskFileSelection;
}

/** Responsibilities: _task report formatting_. **/
export interface TaskCleanReportContract {
	format(skip_review: boolean): string;
}

/** Responsibilities: _task issue document writing_. **/
export interface TaskIssueDocumentContract {
	write(
		violations: readonly ReportViolation[],
		review_files: readonly string[],
		documents: ReadonlyMap<TaskWorkspaceDocument, string>,
	): void;
}

/** Responsibilities: _project source scanning_. **/
export interface ProjectSourceScannerContract {
	files(): string[];
	entry(file: string): boolean;
	resolved_imports(file: string, available: Set<string>): Set<string>;
	unresolved_relative_imports(file: string, available: ReadonlySet<string>): string[];
}

/** Responsibilities: _keyed source reference indexing_. **/
export interface SourceReferenceIndexContract<TKey extends {}> {
	add_implementation(key: TKey, reference: SourceReference): void;
	add_usage(key: TKey, reference: SourceReference): void;
	references_for(key: TKey, relation: SourceReferenceRelation): readonly SourceReference[];
	repeated_usages(minimum_repetitions: number): readonly SourceReference[];
}

/** Responsibilities: _dynamic binding name resolution_. **/
export interface DynamicBindingNamesContract {
	collection(expression: ts.Expression, source_file: ts.SourceFile): boolean;
}

/** Responsibilities: _fake object callable members_. **/
export interface FakeObjectContract {
	callable_member(property: ts.ObjectLiteralElementLike): boolean;
	fake_object(node: ts.Node): boolean;
}

/** Responsibilities: _TypeScript expression alias operations_. **/
export interface TypeScriptExpressionAliasesContract {
	append_alias(aliases: Set<string>, name: string, initializer: ts.Expression): boolean;
	unwrapped(expression: ts.Expression): ts.Expression;
	receiver(expression: ts.Expression, node: ts.Node): boolean;
	member_name(expression: ts.Expression): string;
}

/** Responsibilities: _TypeScript type alias resolution_. **/
export interface TypeScriptTypeAliasesContract {
	collect(source_file: ts.SourceFile): void;
	resolve(name: string): string;
}

/** Responsibilities: _rooted project path relation_. **/
export interface ProjectPathRelationContract {
	readonly relative_path: string;
	readonly inside: boolean;
	readonly first_segment: string;
	strictly_nested(): boolean;
	contains_any_directory(names: ReadonlySet<string>): boolean;
}

/** Responsibilities: _Gitignore matcher access_. **/
/** Responsibilities: _placement destination selection_. **/
export interface PlacementSupportContract {
	suggested_member_location(root: string, target: string, importers: string[], kind: string): string;
}

/** Responsibilities: _Jest matcher expression access_. **/
export interface JestMatcherAccessContract {
	receiver_available(expression: ts.Expression): boolean;
	receiver(expression: ts.Expression): ts.Expression;
	member_name(expression: ts.Expression): string;
}

/** Responsibilities: _exception flag binding lookup_. **/
export interface JestExceptionFlagBindingsContract {
	index_declarations(): void;
	exception_flags(callback: ts.ArrowFunction): ReadonlySet<ts.Node>;
	exception_flag(identifier: ts.Identifier, flags: ReadonlySet<ts.Node>): boolean;
}

/** Responsibilities: _static object arguments contract_. **/
export interface TypeScriptStaticObjectArgumentsContract {
	append_declaration(node: ts.VariableDeclaration): boolean;
	append_assignment(node: ts.BinaryExpression): boolean;
	append_spread(element: ts.SpreadElement, append_value: SpreadValueAppender): boolean;
}

/** Responsibilities: _TypeScript object property collection_. **/
export interface TypeScriptObjectPropertyCollectorContract {
	appended(node: ts.VariableDeclaration, initializer: ts.Expression): boolean;
}

/** Responsibilities: _TypeScript object alias operations_. **/
export interface TypeScriptObjectAliasesContract {
	collect(scope: ts.Node): void;
	value(expression: ts.Expression): ts.Expression;
	property_values(expression: ts.Expression, property_name: string): readonly ts.Expression[];
}

/** Responsibilities: _factory array alias operations_. **/
export interface TypeScriptFactoryArrayAliasesContract {
	names(): ReadonlySet<string>;
	expressions(declaration: ts.VariableDeclaration, name: string): ReadonlyMap<string, ts.FunctionLikeDeclarationBase>;
	nested_expressions(
		binding: ts.ArrayBindingPattern,
		initializer: ts.Expression,
		name: string,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase>;
	source(declaration: ts.VariableDeclaration, name: string): string;
}

/** Responsibilities: _factory object property operations_. **/
export interface TypeScriptFactoryObjectPropertiesContract {
	property_key(property: ts.ObjectLiteralElementLike): string;
	expressions(
		initializer: ts.ObjectLiteralExpression,
		property_name: string,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase>;
	source(initializer: ts.ObjectLiteralExpression, property_name: string): string;
	binding_expressions(
		initializer: ts.ObjectLiteralExpression,
		binding: ts.ObjectBindingPattern,
		name: string,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase>;
}

/** Responsibilities: _test file organization lookup_. **/
export interface TestFileOrganizationContract {
	valid(file: string): boolean;
	source_directory(segments: string[]): boolean;
	module_paths(file: string): string[][];
}

/** Responsibilities: _test target validation contract_. **/
export interface TestTargetsContract {
	valid(file: string, text: string, python: boolean, python_imports: readonly AstPythonImport[]): boolean;
	valid_typescript(file: string, source_file: ts.SourceFile): boolean;
}

/** Responsibilities: _single-class file naming_. **/
export interface SingleClassFileNameRuleContract {
	append(violations: ViolationContract[], file: string, classes: readonly AstClassNode[]): void;
	expected_file_name(class_name: string, file: string): string;
	focused_class_file(file: string, classes: readonly AstClassNode[]): boolean;
}

/** Responsibilities: _directory rule aggregation_. **/
export interface DirectoryRulesContract {
	append_file_violation(options: DirectoryFileViolationOptions): void;
	collect_directory_violations(
		files: string[],
		repo_root: string,
		class_counts: ReadonlyMap<string, number>,
		source_asts: ReadonlyMap<string, NormalizedAstFile>,
		directory_files: DirectoryFileSet,
	): ViolationContract[];
}

/** Responsibilities: _text rule evaluation_. **/
export interface CyrillicTextRulesContract {
	text_file_violations(file: string, text: string): ViolationContract[];
}

/** Responsibilities: _namespace type import resolution_. **/
export interface AstNamespaceTypeImportsContract {
	module(namespace: string): string;
	key(name: string): string;
}
/** Responsibilities: _namespace alias resolution_. **/
export interface TypeScriptNamespaceAliasesContract {
	names(): ReadonlySet<string>;
	target(initializer: ts.Expression): string;
}

/** Responsibilities: _TypeScript any/unknown type diagnostics_. **/
export interface AnyTypesContract {
	append_any_info(
		violations: ViolationContract[],
		file: string,
		functions: readonly AstCallableNodeContract[],
		methods: readonly AstCallableNodeContract[],
		classes: readonly AstClassNode[],
	): void;
	append_field_infos(violations: ViolationContract[], file: string, classes: readonly AstClassNode[]): void;
}

/** Responsibilities: _object result detection_. **/
export interface TypeScriptContractNameLookupContract {
	contains(name: string): boolean;
}

/** Responsibilities: _object result detection_. **/
export interface ObjectLiteralReturnsContract {
	append_violations(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		index: TypeScriptAstNodeCollection,
	): void;
	object_return(node: ts.ReturnStatement, contract_names: TypeScriptContractNameLookupContract): boolean;
}

/** Responsibilities: _test target root resolution_. **/
export interface TestTargetRootsContract {
	common_root(file: string, imports: string[], python: boolean, module_path: string[]): string[];
	matches(file: string, imports: string[], python: boolean): boolean;
	matches_target_path(file: string, declaration_path: string): boolean;
}

/** Responsibilities: _project-aware test import resolution_. **/
export interface TestTargetImportResolverContract {
	path(file: string, specifier: string): string;
	declaration_paths(file: string, imports: readonly TestTargetImport[], python: boolean): string[];
}

/** Responsibilities: _project context import resolution_. **/
export interface ProjectSourceContextImportsContract {
	imports(file: string): string[];
	path(file: string, specifier: string): string;
	path_alias_configured(file: string, specifier: string): boolean;
	declaration_path(file: string, specifier: string, name: string): string;
}

/** Responsibilities: _callable object alias binding_. **/
export interface ObjectCallableBindingContract {
	variable(aliases: Set<string>, node: ts.VariableDeclaration): boolean;
	append_scope(aliases: Set<string>, node: ts.Node): boolean;
}

/** Responsibilities: _private member key resolution_. **/
export interface PrivateMemberKeysContract {
	member_name(member: ts.ClassElement, source_file: ts.SourceFile): string;
	access_key(access: ts.ElementAccessExpression): string;
}
/** Responsibilities: _source syntax analysis_. **/
export interface SyntaxContract {
	syntax_issues(source_file: ts.SourceFile): readonly ts.DiagnosticWithLocation[];
	type_kind(node: ts.TypeNode): AstTypeKind;
	split_lines(text: string): string[];
	append_parse_issues(
		violations: ViolationContract[],
		file: string,
		issues: AstParseIssue[],
		language: ParseLanguage,
	): void;
}
/** Responsibilities: _project source entry classification_. **/
export interface ProjectSourceEntryContract {
	relative_path(file: string): string;
	entry(file: string): boolean;
}
/** Responsibilities: _Python source import resolution_. **/
export interface ProjectSourcePythonContract {
	select_import_candidate(base: string, files: ReadonlySet<string>): string;
	python_import_path(root: string, importer: string, specifier: string, files: ReadonlySet<string>): string;
	python_import(root: string, specifier: string, files: ReadonlySet<string>): boolean;
	append_import_names(
		specifiers: string[],
		item: AstPythonImport,
		root: string,
		importer: string,
		files: ReadonlySet<string>,
	): void;
}
/** Responsibilities: _file violation collection_. **/
export interface CodingRuleLinterContract {
	lint_python(source_ast: SourceFileAstContract): ViolationContract[];
	lint_typescript(source_ast: SourceFileAstContract, stage_timer: LintStageTimerContract): ViolationContract[];
}

/** Responsibilities: _file violation collection_. **/
export interface FileViolationCollectorContract {
	append_remaining_violations(options: RemainingViolationOptions, coding_rule_linter: CodingRuleLinterContract): void;
	append_directory(
		violations: ViolationContract[],
		source: LintSourceRecord,
		file: string,
		text: string,
		project_root: string,
	): void;
}
/** Responsibilities: _directory code lines_. **/
export interface DirectoryCommentSegmentsContract {
	count_code_lines(text: string, python: boolean, docstring_spans: readonly AstSourceSpan[]): number;
}
/** Responsibilities: _class metric reporting_. **/
export interface ClassReportingContract {
	report_class_methods(violations: ViolationContract[], file_name: LintFileNameContract, node: AstClassNode): void;
	report_test_limits(input: MaxMethodMetricInput): void;
}
/** Responsibilities: _method contract rule collection_. **/
export interface MethodContractRulesContract {
	append(violations: ViolationContract[], file: string, nodes: readonly AstCallableNodeContract[]): void;
	append_flag_parameters(
		violations: ViolationContract[],
		file: string,
		nodes: readonly AstCallableNodeContract[],
	): void;
}
/** Responsibilities: _test path classification_. **/
export interface TestPathSyntaxContract {
	test_file_name(file: string): boolean;
	test_file(file: string, tests_directory_only: boolean): boolean;
}
/** Responsibilities: _Python test rule collection_. **/
export interface PythonTestRuleCollectorContract {
	append_shape(): void;
	append_assertions(): void;
}
/** Responsibilities: _module declaration separation_. **/
export interface ModuleDeclarationsRuleContract {
	append(violations: ViolationContract[], file: string, ast: NormalizedAstFile): void;
	declaration_module(file: string): boolean;
}
/** Responsibilities: _AST property type resolution_. **/
export interface AstPropertyTypeContract {
	required_field(base: ts.Identifier, property: string): boolean;
	known_field(base: ts.Identifier, property: string): boolean;
}
/** Responsibilities: _AST property source resolution_. **/
export interface AstPropertySourcesContract {
	declaration_key(file: string, name: string): string;
	binding_type(identifier: ts.Identifier): ts.TypeNode;
	declaration_exists(key: string): boolean;
	declaration(key: string): ts.Declaration;
}
/** Responsibilities: _callable method count access_. **/
export interface CallableMethodCountsContract {
	append(definition: CallableDefinition): void;
	count(name: string): number;
}
/** Responsibilities: _callable reference matching_. **/
export interface CallableReferenceMatcherContract {
	file_references(file: ParsedFile, method_count: number): boolean;
	external_files(excluded_file: string, method_count: number, candidate_files: ReadonlySet<string>): Set<string>;
}
/** Responsibilities: _callable definition usage reporting_. **/
export interface CallableDefinitionUsageContract {
	external_method(): boolean;
	collect_violations(): ViolationContract[];
}
/** Responsibilities: _Jest expression matching_. **/
export interface JestExpressionMatchContract {
	value_available(): boolean;
	value(): ts.Expression;
}
/** Responsibilities: _object literal alias collection_. **/
export interface ObjectLiteralAliasesContract {
	contains(expression: ts.Expression, source: ts.Node): boolean;
}
/** Responsibilities: _object callable alias collection_. **/
export interface ObjectCallableAliasesContract {
	contains(name: ts.Identifier, source: ts.Node): boolean;
}
/** Responsibilities: _imported name collection_. **/
export interface ImportedNamesContract {
	collect(): ReadonlySet<string>;
	name(name: string): boolean;
}
/** Responsibilities: _class alias resolution_. **/
export interface TypeScriptClassAliasesContract {
	names(): ReadonlySet<string>;
	name(name: string): boolean;
	access(expression: ts.Expression): boolean;
}
/** Responsibilities: _factory object alias collection_. **/
export interface TypeScriptFactoryObjectAliasesContract {
	append_expression(
		declaration: ts.VariableDeclaration,
		name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void;
	names(): ReadonlySet<string>;
	source(declaration: ts.VariableDeclaration, name: string): string;
	property_bodies(expression: ts.Expression): readonly ts.FunctionLikeDeclarationBase[];
}
/** Responsibilities: _factory alias aggregation_. **/
export interface TypeScriptFactoryAliasesContract {
	names(): ReadonlySet<string>;
	sources(name: string): readonly string[];
	inline_bodies(name: string): readonly ts.FunctionLikeDeclarationBase[];
	property_bodies(expression: ts.Expression): readonly ts.FunctionLikeDeclarationBase[];
}
/** Responsibilities: _singleton expression detection_. **/
export interface TypeScriptSingletonExpressionsContract {
	initializer(expression: ts.Expression): boolean;
	variable(declaration: ts.VariableDeclaration): boolean;
}
/** Responsibilities: _block instance collection_. **/
export interface TypeScriptBlockInstanceCaptureContract {
	module_variables(statements: readonly ts.Statement[]): ts.VariableDeclaration[];
	module_variable_names(declarations: readonly ts.VariableDeclaration[]): ReadonlySet<string>;
	escaped_variables(block: ts.Block, names: ReadonlySet<string>): ts.VariableDeclaration[];
}
/** Responsibilities: _AST property source graph_. **/
export interface AstPropertySourceGraphContract {
	source(file: string): ts.SourceFile;
	binding_type(identifier: ts.Identifier, unknown_type: ts.TypeNode): ts.TypeNode;
	declaration(key: string): AstDeclarationLookupContract;
}
/** Responsibilities: _AST declaration lookup_. **/
export interface AstDeclarationLookupContract {
	found(): boolean;
	value(): ts.Declaration;
	type_alias(): boolean;
	interface(): boolean;
}
/** Responsibilities: _Python AST batch caching_. **/
export interface PythonAstBatchCacheContract {
	cached(text: string): AstCacheEntryContract;
	resolve(options: PythonBatchAstOptions, parse: PythonAstBatchParser): NormalizedAstFile[];
}
/** Responsibilities: _TypeScript basic rule collection_. **/
export interface TypeScriptBasicRulesContract {
	append_parameter_rules(node: ts.Node, append_rule: RuleAppender): void;
	append_alias_rules(node: ts.Node, append_rule: RuleAppender): void;
}

/** Responsibilities: _TypeScript expression rule collection_. **/
export interface TypeScriptExpressionRulesContract {
	append(node: ts.Node, append_rule: RuleAppender): void;
}
/** Responsibilities: _Python coding rule collection_. **/
export interface PythonCodingRuleCollectorContract {
	collect_python_rules(source: CodingRuleSourceData): ViolationContract[];
	append_ast_issues(violations: ViolationContract[], source: CodingRuleSourceData, issues: AstCodingIssue[]): void;
}

/** Responsibilities: _coding source access_. **/
export type CodingRuleSourceData = {
	file: string;
	text: string;
	normalized_ast: NormalizedAstFile;
	source_file: ts.SourceFile;
	source_resolver: SourceFileResolver;
	traversal: TypeScriptAstTraversalContract;
};

/** Responsibilities: _coding source snapshot access_. **/
export interface CodingRuleSourceContract {
	snapshot(): CodingRuleSourceData;
}

/** Responsibilities: _coding source AST access_. **/
export interface SourceFileAstContract {
	snapshot(): CodingRuleSourceData;
	python(): boolean;
	typescript(): boolean;
}

/** Responsibilities: _TypeScript factory object sources_. **/
export interface TypeScriptFactoryObjectSourcesContract {
	values(): Map<string, ts.ObjectLiteralExpression>;
	append(expression: ts.Expression, visitor: ObjectSourceVisitor): void;
}
