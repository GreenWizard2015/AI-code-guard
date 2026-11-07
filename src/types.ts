import type { LintFileNameContract } from "src/core/support/protocols";
import type {
	AstClassNode,
	AstLanguage,
	AstTypeKind,
	AstVisibility,
	NormalizedAstFile,
} from "src/model/ast/normalized_ast_types";
import type { TypeScriptReferenceQuery, TypeScriptReferenceResolutionContract } from "src/model/protocols";
import type { ArgumentUse, TypedArgument } from "src/model/types";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import type { ProjectNames, ProjectSourceAnalysisOptions } from "src/project_analysis_types";
import type { RuleContract, ViolationContract } from "src/reporting_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { AstPropertySourceIndexContract } from "src/source_protocols";
import type { LintSourceRecordData, SourceFileResolver } from "src/source_types";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type ts from "typescript";

export enum TestPathKind {
	TestFileName = 0,
	TestFile = 1,
	RootTestsFile = 2,
	TypeScriptTestFile = 3,
}

export type TaskIssueFileViolationDetails = {
	messages: ReadonlySet<string>;
	hints: ReadonlySet<string>;
	single_violation: boolean;
};

export type CallableStageOperation<T> = () => T;

/** Responsibilities: _scope capability_, _project analysis access_. **/
export interface TypeScriptRuleScopeContract {
	project_scope(): boolean;
	project_analysis(): ProjectSourceAnalysisOptions;
	source_files(language: AstLanguage): readonly LintSourceRecordData[];
}

export type TypeScriptRuleContextOptions = {
	stage_timer: LintStageTimerContract;
	normalized_ast: NormalizedAstFile;
	project_names: ProjectNames;
	rule_scope: TypeScriptRuleScopeContract;
	source_resolver: SourceFileResolver;
	module_exports: TypeScriptModuleExportsContract;
	source_index: AstPropertySourceIndexContract;
	traversal: TypeScriptAstTraversalContract;
};
export type CallableOwnershipRequest = {
	class_node: AstClassNode;
	owner: string;
	method_name: string;
	definition_file: string;
	source_file: string;
};
export type CallableOwnershipResolver = (request: CallableOwnershipRequest) => boolean;

type ClassMetricViolationKind = "class_size" | "short_class" | "class_methods";
type CallableMetricViolationKind = "short_function" | "short_method" | "long_function";
type LengthMetricViolationKind = "long_method" | "arguments";
export type MetricViolationKind = ClassMetricViolationKind | CallableMetricViolationKind | LengthMetricViolationKind;

export type Assignment = {
	line: number;
	name: string;
	initializer: ts.Expression;
	simple_alias: boolean;
	destructured: boolean;
};
export type NamedDeclaration = { name: string; line: number; has_self: boolean };
export type CallableRuleAppender = (node: ts.Node, rule_id: string) => void;
/** Responsibilities: _rule source state_. **/
export type RuleSourceState = {
	file: string;
	source_file: ts.SourceFile;
	normalized_ast: NormalizedAstFile;
	test_file: boolean;
	path_kinds: ReadonlySet<TestPathKind>;
};
/** Responsibilities: _rule project state_. **/
export type RuleProjectState = {
	project_names: ProjectNames;
	rule_scope: TypeScriptRuleScopeContract;
};
/** Responsibilities: _rule analysis services_. **/
export type RuleAnalysisState = {
	stage_timer: LintStageTimerContract;
	traversal: TypeScriptAstTraversalContract;
	source_resolver: SourceFileResolver;
	module_resolver: TypeScriptModuleExportsContract;
	source_index: AstPropertySourceIndexContract;
};
/** Responsibilities: _node-scoped rule diagnostics_. **/
export interface RuleNodeDiagnosticContextContract {
	append_rule(rule_id: string): void;
	append_parameterized_rule(rule_id: string, parameters: RuleParameters): void;
	append_diagnostic_rule(rule: RuleContract): void;
}
/** Responsibilities: _rule source state_, _project scope_, _analysis services_. **/
export type RuleContextState = {
	source: RuleSourceState;
	project: RuleProjectState;
	analysis: RuleAnalysisState;
};
/** Responsibilities: _class field rule collection_. **/
export type ClassFieldRuleState = { requires_explicit_visibility: boolean; mutable: boolean };
export type TypeShapeCounts = {
	callables: number;
	data: number;
	methods: number;
};
/** Responsibilities: _rule context state_, _rule collection_. **/
export interface RuleContextContract {
	state(): RuleContextState;
	for_node(node: ts.Node): RuleNodeDiagnosticContextContract;
	append_violation(violation: ViolationContract): void;
}
/** Responsibilities: _source file rule application_. **/
export interface TypeScriptSourceRuleContract {
	append(context: RuleContextContract): void;
}
export type PythonLintInput = {
	file_name: LintFileNameContract;
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

/** Responsibilities: _instance alias reference resolution_. **/
export interface InstanceAliasResolversContract {
	resolve_reference(query: TypeScriptReferenceQuery): TypeScriptReferenceResolutionContract;
}
export type TypeScriptPropertySide = "instance" | "static";
export type TypeScriptPropertyAddress = {
	owner: string;
	property: string;
	side: TypeScriptPropertySide;
};

export type CallableMetricComponents = {
	lines: number;
	sloc: number;
	characters: number;
	control_flow_depth: number;
	argument_uses: ArgumentUse[];
	typed_arguments: TypedArgument[];
};

export type RuleParameters = Record<string, string>;
export type ParseLanguage = "python" | "typescript";
export type CallbackCounts = { readonly total: number; readonly inline: number };
export type CallbackKind = "none" | "typed" | "inline";
export type FieldTypeData = { readonly type: string; readonly type_kind: AstTypeKind };
export type CallableExpressionUnwrapper = (expression: ts.Expression) => ts.Expression[];
export type PropertyOwner = { property_name: string; owner: string };
export type CommentScanResult = { text: string; in_block_comment: boolean };
export type CommentScanOptions = { in_block_comment: boolean; python: boolean };
export type AstImportIssueFlags = { dynamic: boolean; nested: boolean; relative: boolean };
export type SourceRange = { start: number; end: number };
export type CommentSegment = {
	text: string;
	in_block_comment: boolean;
	result: CommentScanResult;
	complete: boolean;
};
