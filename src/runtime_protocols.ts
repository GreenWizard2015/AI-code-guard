import type {
	GitIgnoreGlobMatchResult,
	LintAnalysisStage,
	LintRunResult,
	LintRunState,
} from "src/project_analysis_types";
import type { LintSourceRecord } from "src/source_types";
import type { RuleContextData } from "src/types";
import type ts from "typescript";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { ExpressionNormalizer, AliasAppender } from "src/runtime_types";
import type { LintInputFiles } from "src/project_analysis_types";
import type { LintExecutionReport } from "src/runtime_types";
import type { LintReportOptions } from "src/core/types";
import type { PythonAstWorkerContract } from "src/core/python-ast-worker.mjs";

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
	context(records: readonly LintSourceRecord[]): string;
	directory_context(root: string): string;
	selection(files: ReadonlySet<string>, ignored_files: ReadonlySet<string>, entry_files: ReadonlySet<string>): string;
}

/** Responsibilities: _project lint configuration access_. **/
export interface LintRunConfigurationContract {
	readonly python_ast_worker: PythonAstWorkerContract;
	input_files(repo_root: string, configured: readonly string[]): LintInputFiles;
	lint_report(options: LintReportOptions): LintExecutionReport;
}

/** Responsibilities: _Git ignored path filtering_. **/
export interface GitIgnoredPathsContract {
	filter(files: readonly string[]): string[];
}

/** Responsibilities: _bounded Gitignore glob matching_. **/
export interface GitIgnoreGlobTokenContract {
	advance(candidate: string, index: number, current_row: Uint8Array, next_row: Uint8Array): boolean;
}

/** Responsibilities: _Gitignore glob matching_. **/
export interface GitIgnoreGlobMatcherContract {
	match_candidate(candidate: string): GitIgnoreGlobMatchResult;
	match_segments(candidate: string): GitIgnoreGlobMatchResult;
}

/** Responsibilities: _lint stage analysis coordination_. **/
export interface LintRunAnalysisContract {
	collect_directory(state: LintRunState): ViolationContract[];
	collect_file(state: LintRunState, stage_timer: LintStageTimerContract): ViolationContract[];
	collect_global(stage: LintAnalysisStage): ViolationContract[];
	collect(stage: LintAnalysisStage): LintRunResult;
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
export interface DynamicRuntimeUsageContract {
	append_candidate_rule(node: ts.Node, context: RuleContextData): void;
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
}

/** Responsibilities: _dynamic object member aliases_. **/
export interface DynamicObjectMemberAliasesContract {
	member_name(expression: ts.Expression): string;
	receiver(expression: ts.Expression, source: ts.Node): boolean;
	member(expression: ts.Expression, source: ts.Node, member_name: string): boolean;
}

/** Responsibilities: _class design metrics_, _class size metrics_. **/
export interface ClassStructureReporterContract {
	report_design(): void;
	report_sizes(): void;
	report_max_sizes(): void;
	append_interface_limit(): void;
}
