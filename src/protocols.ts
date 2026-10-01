import type ts from "typescript";
import type { RuleParameters } from "src/types";
import type {
	LintRunStatistics,
	LintSourceRecord,
	LintStageDuration,
	NormalizedAstFile,
	PythonBatchAstOptions,
	TaskReportingOptions,
	ReferenceData,
} from "src/types";
import { Violation as ViolationClass } from "src/parser/ts/violation";
import type { ReportViolation } from "src/types";

export type ReferenceDataLoader = (file: string) => ReferenceData;
export type EntryPointPredicate = (file: string) => boolean;
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
export type BindingAliasAppender = (binding: ts.BindingName, initializer: ts.Expression) => boolean;
export type ExpressionNormalizer = (expression: ts.Expression) => ts.Expression;
export type AliasAppender = (name: string, initializer: ts.Expression) => boolean;
export type MemberAliasAppender = (aliases: Map<string, Set<string>>, name: string, property: string) => boolean;
export type MemberValueAppender = (
	aliases: Map<string, Set<string>>,
	name: string,
	initializer: ts.Expression,
	node: ts.Node,
) => boolean;
export type ExpressionUnwrapper = (expression: ts.Expression) => ts.Expression;
export type StaticArraySourceAppender = (values: ts.Expression[], expression: ts.Expression) => boolean;
export type StaticObjectBranchAppender = (expression: ts.Expression) => boolean;
export type StaticObjectValueAppender = (value: ts.Expression) => boolean;
export type SourceFileResolver = (file: string) => ts.SourceFile[];
export type PythonAstBatchParser = (texts: readonly string[]) => NormalizedAstFile[];
export type ArrayElementsResolver = (initializer: ts.ArrayLiteralExpression) => readonly ts.Expression[];
export type SourceLineResolver = (position: number) => number;
export type Operation<T> = () => T;
export type SpreadValueAppender = (expression: ts.Expression) => boolean;
export type StaticValueResolver = (expression: ts.Expression, node: ts.Node) => string;
export type MapValueAppender = (values: Map<string, string>, name: string, initializer: ts.Expression) => boolean;
export type NodeBodyResolver<T> = (body: ts.Node) => T;
export type StatementPredicate = (statement: ts.Statement) => boolean;
export type NameRelationsResolver = (name: string) => string[];
export type ObjectSourceAppender = (expression: ts.Expression, visitor: ObjectSourceVisitor) => void;
export type CallableConsumer = (callback: ts.FunctionLikeDeclaration) => void;
export type NodeVisitor = (node: ts.Node) => void;
export type ArrayValuesVisitor = (values: readonly ts.Expression[]) => void;

/** Responsibilities: _define diagnostic violation contract_. **/
export interface Violation extends ViolationClass {
	details(): ReportViolation;
}

/** Responsibilities: _define diagnostic rule contract_. **/
export interface Rule {
	violation(file: string, line: number, parameters: RuleParameters): Violation;
}

/** Responsibilities: _define project source statistics_. **/
export interface LintProjectContext {
	source_record(file: string): LintSourceRecord;
	files(): readonly LintSourceRecord[];
	statistics(): LintRunStatistics;
}

/** Responsibilities: _property method ownership_. **/
export interface PropertyOwnerCallbacks {
	call_owner(expression: ts.Expression, owner: string): string;
	method_owner(expression: ts.AccessExpression, owner: string): string;
}

/** Responsibilities: _Python AST batch parsing_. **/
export interface PythonAstDataProtocol {
	batch_ast(options: PythonBatchAstOptions): NormalizedAstFile[];
}

/** Responsibilities: _lint stage measurement_. **/
export interface LintStageTimerProtocol {
	add_duration(stage_name: string, elapsed: number): void;
	measure<T>(stage_name: string, operation: Operation<T>): T;
	durations(): readonly LintStageDuration[];
	format(): string;
}

/** Responsibilities: _diagnostic task reporting_. **/
export interface TaskReportingProtocol {
	format(violations: readonly ReportViolation[], options: TaskReportingOptions): string;
}

/** Responsibilities: _TypeScript reference context_. **/
export interface TypeScriptReferenceContextProtocol {
	function_name(expression: ts.Identifier): string;
	method_owner(expression: ts.AccessExpression, current_owner: string): string;
}

/** Responsibilities: _AST file contract_. **/
export interface TypeScriptAstFileProtocol {
	source_file_node(): ts.SourceFile;
	normalized(): NormalizedAstFile;
	reference_normalization(cached: NormalizedAstFile): NormalizedAstFile;
}

/** Responsibilities: _task workspace operations_. **/
export interface TaskWorkspaceProtocol {
	clear_batch(): void;
	write_issues(content: string): void;
	write_report(content: string): void;
	rule_document_path(rule_id: string): string;
}

/** Responsibilities: _task documentation operations_. **/
export interface TaskDocumentationProtocol {
	validate(): void;
	copy_rule_documents(rule_ids: readonly string[], workspace: TaskWorkspaceProtocol): void;
	philosophy(): string;
	architecture_review(review_path: string, review_code: string): string;
}

/** Responsibilities: _task review operations_. **/
export interface TaskReviewProtocol {
	files(): string[];
	line_count(file: string): number;
	text(file: string): string;
	primary_instruction(): string;
	completed(): boolean;
}

/** Responsibilities: _architecture review completion code_. **/
export interface TaskReviewCompletionCodeProtocol {
	completion_code(timestamp: Date): string;
	contains(text: string, current_time: Date): boolean;
}

/** Responsibilities: _project source scanning_. **/
export interface ProjectSourceScannerProtocol {
	files(): string[];
	entry(file: string): boolean;
	resolved_imports(file: string, available: Set<string>): Set<string>;
	unresolved_relative_imports(file: string, available: ReadonlySet<string>): string[];
}

/** Responsibilities: _dynamic binding name resolution_. **/
export interface DynamicBindingNamesProtocol {
	collection(expression: ts.Expression, source_file: ts.SourceFile): boolean;
}

/** Responsibilities: _AST property source lookup_. **/
export interface AstPropertySourcesProtocol {
	module_path(file: string, specifier: string): string;
}

/** Responsibilities: _fake object callable members_. **/
export interface FakeObjectProtocol {
	callable_member(property: ts.ObjectLiteralElementLike): boolean;
	fake_object(node: ts.Node): boolean;
}

/** Responsibilities: _TypeScript expression alias operations_. **/
export interface TypeScriptExpressionAliasesProtocol {
	append_alias(aliases: Set<string>, name: string, initializer: ts.Expression): boolean;
	unwrapped(expression: ts.Expression): ts.Expression;
	receiver(expression: ts.Expression, node: ts.Node): boolean;
}

/** Responsibilities: _TypeScript type alias resolution_. **/
export interface TypeScriptTypeAliasesProtocol {
	resolve(name: string): string;
}

/** Responsibilities: _static object arguments contract_. **/
export interface TypeScriptStaticObjectArgumentsProtocol {
	append_declaration(node: ts.VariableDeclaration): boolean;
	append_assignment(node: ts.BinaryExpression): boolean;
	append_spread(element: ts.SpreadElement, append_value: SpreadValueAppender): boolean;
}

/** Responsibilities: _TypeScript object property collection_. **/
export interface TypeScriptObjectPropertyCollectorProtocol {
	appended(node: ts.VariableDeclaration, initializer: ts.Expression): boolean;
}

/** Responsibilities: _TypeScript object alias operations_. **/
export interface TypeScriptObjectAliasesProtocol {
	collect(scope: ts.Node): void;
	value(expression: ts.Expression): ts.Expression;
}

/** Responsibilities: _factory array alias operations_. **/
export interface TypeScriptFactoryArrayAliasesProtocol {
	nested_expressions(
		binding: ts.ArrayBindingPattern,
		initializer: ts.Expression,
		name: string,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase>;
}

/** Responsibilities: _factory object property operations_. **/
export interface TypeScriptFactoryObjectPropertiesProtocol {
	property_key(property: ts.ObjectLiteralElementLike): string;
	expressions(
		initializer: ts.ObjectLiteralExpression,
		property_name: string,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase>;
}

/** Responsibilities: _test file organization lookup_. **/
export interface TestFileOrganizationProtocol {
	source_directory(segments: string[]): boolean;
	module_paths(file: string): string[][];
}

/** Responsibilities: _coding source access_. **/
export type CodingRuleSourceData = {
	file: string;
	text: string;
	normalized_ast: NormalizedAstFile;
	source_file: ts.SourceFile;
};

/** Responsibilities: _coding source snapshot access_. **/
export interface CodingRuleSourceProtocol {
	snapshot(): CodingRuleSourceData;
}

/** Responsibilities: _coding source AST access_. **/
export interface SourceFileAstProtocol {
	snapshot(): CodingRuleSourceData;
	python(): boolean;
	typescript(): boolean;
}
