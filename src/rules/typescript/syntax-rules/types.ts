import type { SharedParameterTypeSource } from "src/metrics/types";
import type {
	AstCallableNode,
	AstClassNode,
	NamedLine,
	NamedSymbol,
	NormalizedAstFile,
} from "src/model/ast/normalized_ast_types";
import type { CodeClass } from "src/model_types";
import type { TypeScriptModuleSymbolReference } from "src/module-resolution/types";
import type { ProjectSourceAnalysisOptions } from "src/project_analysis_types";
import type { ProjectNames } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type { TestFileViolationCollectorContract } from "src/testing_protocols";
import type { RuleContextContract, RuleContextState } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import type ts from "typescript";

export type ConstructorLocalValues = {
	declarations: ts.VariableDeclaration[];
	assignments: ts.BinaryExpression[];
};

export type ProjectViolationsByFile = ReadonlyMap<string, readonly ViolationContract[]>;
export type DirectoryRuleContext = {
	readonly analysis: ProjectSourceAnalysisOptions;
	readonly owner: LintSourceRecordData;
	readonly files: string[];
};
export type CallableProjectViolationCollector = () => readonly ViolationContract[];
export type ProjectBoundaryNameSets = {
	readonly project_class_names: ReadonlySet<string>;
	readonly allowed_contracts: ReadonlySet<string>;
	readonly forbidden_project_types: ReadonlySet<string>;
};
export type ProjectBoundaryNamesByProject = WeakMap<ProjectNames, ProjectBoundaryNameSets>;
export type CallableAstScopePredicate = (node: ts.Node) => boolean;
export type NestedDeclarationLines = { classes: number[]; types: number[] };
export type ObjectReturnNodes = {
	readonly aliases: ts.TypeAliasDeclaration[];
	readonly returns: ts.ReturnStatement[];
};
export type FiniteVariantSourceNodes = {
	readonly declarations: ts.Node[];
	readonly switches: ts.SwitchStatement[];
};
export type ExceptionClassSummary = {
	readonly count: number;
	readonly line: number;
};
export type ImplementationClassSummary = {
	readonly count: number;
	readonly second_class_line: number;
};
export type TopLevelRuleInput = {
	readonly context: RuleContextContract;
	readonly module_functions_present: boolean;
	readonly exception_summary: ExceptionClassSummary;
	readonly implementation_summary: ImplementationClassSummary;
};
export type ClassLineMap = ReadonlyMap<number, readonly AstClassNode[]>;
export type CallableLineMap = ReadonlyMap<number, readonly AstCallableNode[]>;
export type ProjectViolationsByScope = WeakMap<ProjectSourceAnalysisOptions, ProjectViolationsByFile>;
export type ProjectContextViolationsByScope = WeakMap<LintProjectContextContract, ProjectViolationsByFile>;
export type LineNumbers = Set<number>;
export type DictionaryNames = ReadonlySet<string>;
export type ImportLineIndex = WeakMap<RuleContextContract, LineNumbers>;
export type DictionaryNameIndex = WeakMap<ts.SourceFile, DictionaryNames>;

/** Responsibilities: _TypeScript numeric expression evaluation_. **/
export interface TypeScriptNumericExpressionEvaluatorContract {
	unwrap(source_expression: ts.Expression): ts.Expression;
	value(source_expression: ts.Expression): number;
}

/** Responsibilities: _class metric source nodes_. **/
export type TypeScriptClassMetricsSourceInput = {
	readonly source_file: ts.SourceFile;
	readonly normalized_ast: NormalizedAstFile;
	readonly declarations: readonly ts.Node[];
};

/** Responsibilities: _class metric build state_. **/
export type TypeScriptClassMetricsBuildInput = {
	readonly context_state: RuleContextState;
	readonly source_input: TypeScriptClassMetricsSourceInput;
};

export type TypeScriptClassMetricsSource = {
	readonly classes_by_position: ReadonlyMap<number, AstClassNode>;
	readonly inherited_state_nodes: InheritedStateNodes;
	readonly runtime_class_count: number;
	readonly suppress_short_class: boolean;
};

/** Responsibilities: _class source metric construction_, _source metric caching_. **/
export interface TypeScriptClassMetricsSourceIndexContract {
	source_metrics(
		cache_context: RuleContextContract,
		source_input: TypeScriptClassMetricsSourceInput,
	): TypeScriptClassMetricsSource;
}

export type ProjectClassMetricsState = {
	readonly inherited_state_nodes: InheritedStateNodes;
	readonly runtime_class_count: number;
};
export type TypeScriptClassMetricsTarget = {
	readonly declaration: ts.Node;
	readonly node: AstClassNode;
	readonly source_metrics: TypeScriptClassMetricsSource;
};

/** Responsibilities: _hidden global collection indexing_, _mutation ownership reporting_. **/
export interface TypeScriptHiddenGlobalStateIndexContract {
	reset_source(): void;
	append_collection_declarations(statement: ts.VariableStatement, source_file: ts.SourceFile): void;
	append_mutation(context: RuleContextContract, mutation: ts.Node): void;
	take_mutations(context: RuleContextContract): ts.Node[];
	report_shared_state(context: RuleContextContract, nodes: readonly ts.Node[]): void;
}

export type CallableNodePredicate = (node: ts.Node) => boolean;

export type ClassByPosition = ReadonlyMap<number, CodeClass>;

export type ClassCacheBySource = WeakMap<ts.SourceFile, ClassByPosition>;

export type InheritedStateNodes = ReadonlySet<string>;

/** Responsibilities: _project inherited state collection_, _scope result caching_. **/
export interface TypeScriptInheritedStateClassNamesContract {
	collect(scope: ProjectSourceAnalysisOptions): InheritedStateNodes;
}

export type InheritedStateCache = WeakMap<ProjectSourceAnalysisOptions, InheritedStateNodes>;
export type InheritedStateTraversal = {
	readonly dependents: ReadonlyMap<string, readonly string[]>;
	readonly inherited_names: Set<string>;
	readonly pending: string[];
	readonly stateful_names: Set<string>;
};
export type InheritedStateImportBinding = {
	readonly symbol: TypeScriptModuleSymbolReference;
	readonly namespace: boolean;
};
export type InheritedStateModuleContext = {
	readonly source_file: ts.SourceFile;
	readonly imports: Map<string, InheritedStateImportBinding>;
};
export type InheritedStateImportScope = {
	readonly module_file: string;
	readonly module: InheritedStateModuleContext;
};
export type InheritedStateDeclaration = {
	readonly node: AstClassNode;
	readonly symbol_id: string;
	readonly base_symbol_ids: readonly string[];
	readonly syntax_node: ts.Node;
};
export type NamingIndex = {
	readonly symbols: ReadonlyMap<string, readonly NamedSymbol[]>;
	readonly declarations: ReadonlyMap<string, readonly NamedLine[]>;
	readonly classes: readonly AstClassNode[];
};
export type NamingCandidates = { symbols: NamedLine[]; declarations: NamedLine[] };
export type NamingMatches = { symbols: NamedSymbol[]; declarations: NamedLine[] };
export type NamingScope = { file: string; classes: readonly AstClassNode[] };

export type TypeScriptProjectTestRules = {
	readonly collector: TestFileViolationCollectorContract;
	readonly sources: ReadonlyMap<string, LintSourceRecordData>;
};

export type TypeScriptClassDeclarationAnalysis = {
	readonly request: TypeScriptNodeVerificationRequest;
	readonly state: RuleContextState;
	readonly declaration: AstClassNode;
};

export type ProjectTypeSources = ReadonlyMap<string, SharedParameterTypeSource>;
export type TypeScriptSharedParameterTypeIndex = ReadonlyMap<string, SharedParameterTypeSource>;

export type ProjectFunctionAnalysisRequest = {
	readonly scope: ProjectSourceAnalysisOptions;
	readonly project_types: ReadonlySet<string>;
};

export type ModuleFunctionAnalysis = {
	readonly sources: readonly LintSourceRecordData[];
	readonly type_sources: ProjectTypeSources;
	readonly project_types: ReadonlySet<string>;
};

export type ClassParameterAnalysis = {
	readonly node: ts.Node;
	readonly context: RuleContextContract;
	readonly source_file: ts.SourceFile;
	readonly normalized_ast: NormalizedAstFile;
	readonly file: string;
	readonly test_file: boolean;
	readonly project_types: ReadonlySet<string>;
};
