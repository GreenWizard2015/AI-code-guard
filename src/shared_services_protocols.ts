import type { CallableDefinition, ParsedFile } from "src/metrics/types";
import type {
	AstCallableNode,
	AstClassNode,
	AstLanguage,
	AstParseIssue,
	AstSourceSpan,
	AstTypeKind,
	NormalizedAstFile,
} from "src/model/ast/normalized_ast_types";
import type { DirectoryFileViolationOptions, RemainingViolationOptions } from "src/model_types";
import type { DirectoryFileSet } from "src/project_analysis_types";
import type { ProjectSourceAnalysisOptions } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintStageDuration } from "src/runtime_types";
import type { CallableAsyncOperation, CallableOperation } from "src/runtime_types";
import type { ProjectSourceIOContract, SourceFileAstContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type { SourceReference, SourceReferenceRelation } from "src/source_types";
import type { CodingRuleSourceData } from "src/source_types";
import type { CommentScanResult, LintRunStatistics, ParseLanguage, RuleParameters, TestPathKind } from "src/types";
import type { TypeScriptTypeNameLookupContract } from "src/typescript_runtime_protocols";
import type { TypeScriptAstNodeCollection } from "src/typescript_runtime_types";
import type ts from "typescript";

/** Responsibilities: _comment line data_, _comment scanner state_. **/
export type CommentLineScan = {
	readonly in_block_comment: boolean;
	readonly python: boolean;
	readonly line: string;
};

/** Responsibilities: _comment scan result_. **/
export interface CommentLineScannerContract {
	scan_comment_segments(input: CommentLineScan): CommentScanResult;
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

/** Responsibilities: _define project source statistics_. **/
export interface LintProjectContextContract {
	source_record(file: string): LintSourceRecordData;
	files(): readonly LintSourceRecordData[];
	statistics(): LintRunStatistics;
	source_io(): ProjectSourceIOContract;
}

/** Responsibilities: _property method ownership_. **/
export interface PropertyOwnerCallbacksContract {
	call_owner(expression: ts.Expression, owner: string): string;
	method_owner(expression: ts.AccessExpression, owner: string): string;
}

/** Responsibilities: _lint stage measurement_. **/
export interface LintStageTimerContract {
	add_duration(duration: LintStageDuration): void;
	measure<T>(stage_name: string, operation: CallableOperation<T>): T;
	measure_async<T>(stage_name: string, operation: CallableAsyncOperation<T>): Promise<T>;
	durations(): readonly LintStageDuration[];
	format(): string;
}

/** Responsibilities: _test path classification_. **/
export interface TestPathSyntaxContract {
	classify(file: string): ReadonlySet<TestPathKind>;
}

/** Responsibilities: _global analysis stage inputs_. **/
export type GlobalAnalysisStageOptions = {
	readonly repo_root: string;
	readonly project_files: string[];
	readonly project_type_names: ReadonlySet<string>;
	readonly context: LintProjectContextContract;
	readonly entry_files: readonly string[];
	readonly stage_timer: LintStageTimerContract;
	readonly project_scope: ProjectSourceAnalysisOptions;
};

/** Responsibilities: _keyed source reference indexing_. **/
export interface SourceReferenceIndexContract<TKey extends {}> {
	add_implementation(key: TKey, reference: SourceReference): void;
	add_usage(key: TKey, reference: SourceReference): void;
	add_usage_once(key: TKey, file: string, line: number): void;
	references_for(key: TKey, relation: SourceReferenceRelation): readonly SourceReference[];
	repeated_usages(minimum_repetitions: number): readonly SourceReference[];
}

/** Responsibilities: _dynamic binding name resolution_. **/
export interface DynamicBindingNamesContract {
	collection(expression: ts.Expression, source_file: ts.SourceFile): boolean;
	collection_names(source_file: ts.SourceFile): ReadonlySet<string>;
}

/** Responsibilities: _fake object callable members_. **/
export interface FakeObjectContract {
	callable_member(property: ts.ObjectLiteralElementLike): boolean;
	fake_object(node: ts.Node): boolean;
}

/** Responsibilities: _external contract type resolution_, _per-source import identity caching_. **/
export interface ExternalImportedTypesContract {
	imports_external_name(source_file: ts.SourceFile, local_name: string): boolean;
	external_contract_type(source_file: ts.SourceFile, type_node: ts.TypeNode): boolean;
}

/** Responsibilities: _Gitignore matcher access_. **/
/** Responsibilities: _module placement findings_, _member destination lookup_. **/
export interface PlacementAnalysisContract {
	target(): string;
	valid(): boolean;
	member_location(kind: string): string;
	parameters(members: string): RuleParameters;
}

/** Responsibilities: _single-class file naming_. **/
export interface SingleClassFileNameRuleContract {
	append(violations: ViolationContract[], file: string, classes: readonly AstClassNode[]): void;
	expected_file_name(class_name: string, file: string): string;
}

/** Responsibilities: _directory rule aggregation_. **/
export interface DirectoryRulesContract {
	append_file_violation(options: DirectoryFileViolationOptions): void;
	collect_directory_violations(
		files: string[],
		repo_root: string,
		class_counts: ReadonlyMap<string, readonly AstClassNode[]>,
		source_asts: ReadonlyMap<string, NormalizedAstFile>,
		directory_files: DirectoryFileSet,
	): ViolationContract[];
}

/** Responsibilities: _text rule evaluation_. **/
export interface NonEnglishSourceTextRulesContract {
	text_file_violations(file: string, text: string): ViolationContract[];
}

/** Responsibilities: _TypeScript any/unknown type diagnostics_. **/
export type AnyTypeDiagnosticsContext = {
	readonly violations: ViolationContract[];
	readonly file: string;
	readonly functions: readonly AstCallableNode[];
	readonly methods: readonly AstCallableNode[];
	readonly classes: readonly AstClassNode[];
};

/** Responsibilities: _callable parameter type input_, _parameter diagnostics output_. **/
export type AnyTypeParameterDiagnosticsContext = {
	readonly violations: ViolationContract[];
	readonly file: string;
	readonly callable: AstCallableNode;
	readonly name: string;
	readonly type: string;
};

/** Responsibilities: _TypeScript any/unknown type diagnostics_. **/
export type AnyTypeFieldDiagnosticsContext = {
	readonly violations: ViolationContract[];
	readonly file: string;
	readonly classes: readonly AstClassNode[];
};

/** Responsibilities: _TypeScript any/unknown type diagnostics_. **/
export interface AnyTypesContract {
	append_any_info(context: AnyTypeDiagnosticsContext): void;
	append_field_infos(context: AnyTypeFieldDiagnosticsContext): void;
}

/** Responsibilities: _contract-name alias registration_. **/
export interface ObjectLiteralTypeNameLookupContract extends TypeScriptTypeNameLookupContract {
	register_alias(name: string): void;
}

/** Responsibilities: _object result detection_. **/
export interface ObjectLiteralReturnsContract {
	append_violations(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		index: TypeScriptAstNodeCollection,
	): void;
	object_return(node: ts.ReturnStatement, contract_names: TypeScriptTypeNameLookupContract): boolean;
}

/** Responsibilities: _callable object alias binding_. **/
export interface ObjectCallableBindingContract {
	collect(): ReadonlySet<string>;
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
		source: LintSourceRecordData,
		file: string,
		text: string,
		project_root: string,
	): void;
}

/** Responsibilities: _directory code lines_. **/
export interface DirectoryCommentSegmentsContract {
	count_code_lines(text: string, python: boolean, docstring_spans: readonly AstSourceSpan[]): number;
}

/** Responsibilities: _method contract rule collection_. **/
export interface CallableNamingRulesContract {
	append(violations: ViolationContract[], nodes: readonly AstCallableNode[]): void;
	append_flag_parameters(violations: ViolationContract[], nodes: readonly AstCallableNode[]): void;
}

/** Responsibilities: _module declaration separation_. **/
export interface ModuleDeclarationsRuleContract {
	append(violations: ViolationContract[], file: string, ast: NormalizedAstFile): void;
	declaration_module(file: string): boolean;
}

/** Responsibilities: _callable method count access_. **/
export interface CallableMethodCountsContract {
	append(definition: CallableDefinition): void;
	count(name: string, language: AstLanguage): number;
}

/** Responsibilities: _callable reference matching_. **/
export interface CallableReferenceMatcherContract {
	file_references(file: ParsedFile, method_count: number): boolean;
	external_files(excluded_file: string, method_count: number, candidate_files: ReadonlySet<string>): Set<string>;
}

/** Responsibilities: _callable definition usage reporting_. **/
export interface CallableDefinitionUsageContract {
	collect_violations(): ViolationContract[];
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

/** Responsibilities: _coding source snapshot access_. **/
export interface CodingRuleSourceContract {
	snapshot(): CodingRuleSourceData;
}
