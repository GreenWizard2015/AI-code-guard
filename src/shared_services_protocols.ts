import type { CallableDefinition, ParsedFile } from "src/metrics/types";
import type { DirectoryFileViolationOptions, RemainingViolationOptions } from "src/model/types/types";
import type { DirectoryFileSet } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintStageDuration } from "src/runtime_types";
import type { AsyncOperation, Operation } from "src/runtime_types";
import type { ProjectSourceIOContract, SourceFileAstContract } from "src/source_protocols";
import type { LintSourceRecord } from "src/source_types";
import type { SourceReference, SourceReferenceRelation } from "src/source_types";
import type { CodingRuleSourceData } from "src/source_types";
import type {
	AstCallableNodeContract,
	AstClassNodeContract,
	AstParseIssue,
	AstSourceSpan,
	AstTypeKind,
	LintRunStatistics,
	NamedLine,
	NamedSymbol,
	NormalizedAstFileContract,
	ParseLanguage,
} from "src/types";
import type { TypeScriptContractNameLookupContract } from "src/typescript_runtime_protocols";
import type { TypeScriptAstNodeCollection } from "src/typescript_runtime_types";
import type ts from "typescript";

/** Responsibilities: _pointless expression extraction contract_. **/
export interface PointlessExpressionContract {
	binding_name(name: ts.BindingName): string;
	returned_names_from(statement: ts.Statement): string[];
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

/** Responsibilities: _lint stage measurement_. **/
export interface LintStageTimerContract {
	add_duration(stage_name: string, elapsed: number): void;
	measure<T>(stage_name: string, operation: Operation<T>): T;
	measure_async<T>(stage_name: string, operation: AsyncOperation<T>): Promise<T>;
	durations(): readonly LintStageDuration[];
	format(): string;
}

/** Responsibilities: _undefined-check node rule application_. **/
export interface UndefinedCheckRulesContract {
	append(node: ts.Node): void;
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
	collection_names(source_file: ts.SourceFile): ReadonlySet<string>;
}

/** Responsibilities: _fake object callable members_. **/
export interface FakeObjectContract {
	callable_member(property: ts.ObjectLiteralElementLike): boolean;
	fake_object(node: ts.Node): boolean;
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

/** Responsibilities: _single-class file naming_. **/
export interface SingleClassFileNameRuleContract {
	append(violations: ViolationContract[], file: string, classes: readonly AstClassNodeContract[]): void;
	expected_file_name(class_name: string, file: string): string;
}

/** Responsibilities: _directory rule aggregation_. **/
export interface DirectoryRulesContract {
	append_file_violation(options: DirectoryFileViolationOptions): void;
	collect_directory_violations(
		files: string[],
		repo_root: string,
		class_counts: ReadonlyMap<string, readonly AstClassNodeContract[]>,
		source_asts: ReadonlyMap<string, NormalizedAstFileContract>,
		directory_files: DirectoryFileSet,
	): ViolationContract[];
}

/** Responsibilities: _text rule evaluation_. **/
export interface NonEnglishSourceTextRulesContract {
	text_file_violations(file: string, text: string): ViolationContract[];
}

/** Responsibilities: _TypeScript any/unknown type diagnostics_. **/
export interface AnyTypesContract {
	append_any_info(
		violations: ViolationContract[],
		file: string,
		functions: readonly AstCallableNodeContract[],
		methods: readonly AstCallableNodeContract[],
		classes: readonly AstClassNodeContract[],
	): void;
	append_field_infos(violations: ViolationContract[], file: string, classes: readonly AstClassNodeContract[]): void;
}

/** Responsibilities: _contract-name alias registration_. **/
export interface ContractNameAliasLookupContract extends TypeScriptContractNameLookupContract {
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
	object_return(node: ts.ReturnStatement, contract_names: TypeScriptContractNameLookupContract): boolean;
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

/** Responsibilities: _method contract rule collection_. **/
export interface MethodContractRulesContract {
	append(violations: ViolationContract[], file: string, nodes: readonly AstCallableNodeContract[]): void;
	append_flag_parameters(
		violations: ViolationContract[],
		file: string,
		nodes: readonly AstCallableNodeContract[],
	): void;
}

/** Responsibilities: _module declaration separation_. **/
export interface ModuleDeclarationsRuleContract {
	append(violations: ViolationContract[], file: string, ast: NormalizedAstFileContract): void;
	declaration_module(file: string): boolean;
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
