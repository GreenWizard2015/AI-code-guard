import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import type { LintReportOptions } from "src/core/types";
import type {
	GitIgnoreGlobMatchResult,
	LintAnalysisStage,
	LintRunResult,
	LintRunState,
} from "src/project_analysis_types";
import type { LintInputFiles } from "src/project_analysis_types";
import type {
	PythonAstDataContract,
	PythonAstWorkerCapabilityContract,
	PythonAstWorkerSessionContract,
} from "src/python_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { CallableAliasAppender, CallableExpressionNormalizer } from "src/runtime_types";
import type { LintExecutionReport } from "src/runtime_types";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type ts from "typescript";

/** Responsibilities: _callable body metrics_. **/
export interface CallableBodyMetricsContract {
	characters(node: ts.SignatureDeclarationBase): number;
	lines(node: ts.SignatureDeclarationBase): number;
	sloc(node: ts.SignatureDeclarationBase): number;
	control_flow_depth(node: ts.SignatureDeclarationBase): number;
	exception_only(node: ts.SignatureDeclarationBase): boolean;
}

/** Responsibilities: _class metadata exposure_. **/
export interface ClassNodeContract {
	type_contract(): boolean;
	protocol(): boolean;
	exception(): boolean;
}

/** Responsibilities: _analysis identity hashing_. **/
export interface ProjectAnalysisIdentityContract {
	analyzer(): string;
	content(value: string): string;
	context(records: readonly LintSourceRecordData[]): string;
	directory_context(root: string): string;
	selection(files: ReadonlySet<string>, ignored_files: ReadonlySet<string>, entry_files: ReadonlySet<string>): string;
}

/** Responsibilities: _project lint configuration access_. **/
export interface LintRunConfigurationContract {
	input_files(repo_root: string, configured: readonly string[]): LintInputFiles;
	lint_report(options: LintReportOptions): LintExecutionReport;
}

/** Responsibilities: _Python worker session recovery_, _parser access_. **/
export interface LintRunWorkerLifecycleContract {
	ensure_active(): void;
	worker(): PythonAstWorkerCapabilityContract;
	session(): PythonAstWorkerSessionContract;
	parser(): PythonAstDataContract;
}

/** Responsibilities: _worker session lease state_. **/
export interface WorkerSessionLeaseContract {
	active(): boolean;
	close(): Promise<void>;
}

/** Responsibilities: _active worker session_, _worker session cleanup_. **/
export interface WorkerSessionProviderContract {
	active_worker_session(): WorkerSessionLeaseContract;
	close_worker_session(): Promise<void>;
}

/** Responsibilities: _lint runtime configuration_, _worker session ownership_. **/
export interface LintRunRuntimeContract extends LintRunConfigurationContract, WorkerSessionProviderContract {}

/** Responsibilities: _Git ignored path filtering_. **/
export interface GitIgnoredPathsContract {
	filter(files: readonly string[]): string[];
}

/** Responsibilities: _bounded Gitignore glob matching_. **/
export interface GitIgnoreGlobTokenContract {
	advance(candidate: string, index: number, current_row: Uint8Array, next_row: Uint8Array): boolean;
	advance_row(candidate: string, current_row: Uint8Array, next_row: Uint8Array): void;
	minimum_candidate_length(): number;
	variable_candidate_length(): boolean;
}

/** Responsibilities: _Gitignore glob matching_. **/
export interface GitIgnoreGlobMatcherContract {
	match_candidate(candidate: string): GitIgnoreGlobMatchResult;
	match_segments(candidate: string): GitIgnoreGlobMatchResult;
}

/** Responsibilities: _Gitignore candidate evaluation operations_. **/
export interface GitIgnoreGlobCandidateEvaluationContract {
	match(): GitIgnoreGlobMatchResult;
	match_fixed_width(): GitIgnoreGlobMatchResult;
}

/** Responsibilities: _lint stage analysis coordination_. **/
export interface LintRunAnalysisContract {
	collect_directory(state: LintRunState): ViolationContract[];
	collect_file(state: LintRunState, stage_timer: LintStageTimerContract, context_identity: string): ViolationContract[];
	collect_global(stage: LintAnalysisStage): ViolationContract[];
	collect(stage: LintAnalysisStage): LintRunResult;
}

/** Responsibilities: _text violation discovery contract_. **/
export interface TextFileDiscoveryContract {
	for_project(repo_root: string, configured_ignored: ReadonlySet<string>): TextFileProjectContract;
}

/** Responsibilities: _project-scoped text file analysis_. **/
export interface TextFileProjectContract {
	files(): string[];
	files_unfiltered(): string[];
	files_unfiltered_from(paths: readonly string[]): string[];
	violations(source_texts: ReadonlyMap<string, string>): ViolationContract[];
	violations_for_files(files: readonly string[], source_texts: ReadonlyMap<string, string>): ViolationContract[];
}

/** Responsibilities: _project-scoped text file analysis inputs_. **/
export type TextFileProjectOptions = {
	repo_root: string;
	configured_ignored: ReadonlySet<string>;
	source_io: ProjectSourceIOContract;
	git_ignored_paths: GitIgnoredPathsContract;
};

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
	static_element_name(element: ts.ObjectLiteralElementLike): string;
}

/** Responsibilities: _binding alias collection_. **/
export interface BindingAliasesContract {
	append_binding_aliases(
		aliases: Set<string>,
		binding: ts.BindingName,
		initializer: ts.Expression,
		normalize_initializer: CallableExpressionNormalizer,
		append_alias: CallableAliasAppender,
	): boolean;
}

/** Responsibilities: _alias map_. **/
export interface CallAliasesContract {
	names(source_file: ts.SourceFile): ReadonlyMap<string, string>;
	call_name(call: ts.CallExpression): string;
}

/** Responsibilities: _array state inspection_. **/
export interface ArrayStateInspectorContract {
	single_item_expression(expression: ts.Expression, source_file: ts.SourceFile): boolean;
	single_item_binding(node: ts.ArrayBindingPattern, source_file: ts.SourceFile): boolean;
	single_item_method(node: ts.CallExpression, source_file: ts.SourceFile): boolean;
}

/** Responsibilities: _proxy state_. **/
export interface ProxyCallContract {
	proxy_call(node: ts.Node): ts.Node[];
	supports_target_expression(expression: ts.Expression): boolean;
}

/** Responsibilities: _dynamic runtime usage contract_. **/
export interface DynamicRuntimeUsageContract extends ASTSourceRuleContract {
	dynamic(node: ts.Node, source_file: ts.SourceFile): boolean;
}

/** Responsibilities: _dynamic runtime member contract_. **/
export interface DynamicRuntimeMembersContract {
	matches(node: ts.Node): boolean;
	call(node: ts.CallExpression): boolean;
	construct(node: ts.NewExpression): boolean;
}

/** Responsibilities: _object value rules contract_. **/
export interface ObjectValueRulesContract {
	object_string(node: ts.Node): boolean;
	object_assign(node: ts.Node): boolean;
	object_method(node: ts.Node): boolean;
	object_has_own(node: ts.Node): boolean;
}

/** Responsibilities: _dynamic object member aliases_. **/
export interface DynamicObjectMemberAliasesContract {
	member_name(query: DynamicObjectMemberNameQuery): string;
	receiver(query: DynamicObjectReceiverQuery): boolean;
	member(query: DynamicObjectMemberQuery): boolean;
}

/** Responsibilities: _dynamic member name query_. **/
export type DynamicObjectMemberNameQuery = {
	readonly expression: ts.Expression;
};

/** Responsibilities: _dynamic member lookup_. **/
export type DynamicObjectMemberQuery = {
	readonly expression: ts.Expression;
	readonly source: ts.Node;
	readonly member_name: string;
};

/** Responsibilities: _object receiver lookup_. **/
export type DynamicObjectReceiverQuery = {
	readonly expression: ts.Expression;
	readonly source: ts.Node;
};

/** Responsibilities: _property value lookup_. **/
export type DynamicObjectPropertyValuesQuery = {
	readonly expression: ts.Expression;
	readonly source: ts.Node;
	readonly property_name: string;
};

/** Responsibilities: _member value lookup_. **/
export type DynamicObjectMemberValueQuery = {
	readonly value: ts.Expression;
	readonly source: ts.Node;
	readonly member_name: string;
};

/** Responsibilities: _class design metrics_, _class size metrics_. **/
export interface ClassStructureReporterContract {
	report_test_limits(): void;
	report_class_methods(): void;
	report_design(): void;
	report_sizes(): void;
}
