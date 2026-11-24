import type { SpawnOptions } from "node:child_process";
import {
	MODULE_CLASS_KIND,
	MODULE_CONSTANT_KIND,
	MODULE_TYPE_KIND,
	MODULE_VARIABLE_KIND,
	PUBLIC_FIELD_KIND,
} from "src/constants";
import type { IOContract } from "src/io/protocols";
import type {
	AstCallableNode,
	AstCallableReference,
	AstClassNode,
	AstImportIssue,
	AstLanguage,
	AstLiteralConstant,
	AstLiteralReference,
	AstParseIssue,
	AstReferenceAlias,
	AstTypeMembers,
	LineDepth,
	NamedLine,
	NamedSymbol,
	NormalizedAstFile,
	PythonSourceAstBatch,
} from "src/model/ast/normalized_ast_types";
import type { PythonProjectNames } from "src/model_types";
import type { TaskViolationSuppression } from "src/model_types";
import type {
	DirectoryFileSet,
	LintAnalysisStage,
	LintInputFiles,
	LintRunResult,
	LintRunState,
	ProjectRuleSnapshots,
	ProjectSourceAnalysisOptionsContract,
} from "src/project_analysis_types";
import type {
	PythonAstDataContract,
	PythonAstWorkerCapabilityContract,
	PythonAstWorkerRegistryContract,
	PythonAstWorkerSessionContract,
	PythonSourceFilesContract,
} from "src/python_protocols";
import type { TaskViolationPathContract, ViolationContract } from "src/reporting_protocols";
import type {
	LintRunAnalysisContract,
	LintRunWorkerLifecycleContract,
	ProjectAnalysisIdentityContract,
} from "src/runtime_protocols";
import type { LintRunConfigurationContract } from "src/runtime_protocols";
import type { CallableOperation } from "src/runtime_types";
import type {
	CodingRuleLinterContract,
	FileViolationCollectorContract,
	LintProjectContextContract,
	LintStageTimerContract,
} from "src/shared_services_protocols";
import type {
	LintInputFileSelectorContract,
	ProjectSourceIOContract,
	ProjectSourceScanContract,
} from "src/source_protocols";
import type { TaskReportingContract } from "src/task_protocols";
import type { TaskReviewAgentContract } from "src/task_protocols";
import type { CliOptions, TestTargetLink } from "src/task_types";
import type ts from "typescript";

export type ContextProjectPaths = ReadonlySet<string>;

export type CallableReviewAgentProvider = () => TaskReviewAgentContract;

export type TaskScopedViolationPath = {
	path: TaskViolationPathContract;
	absolute_path: string;
};

export type TaskFilePlanPath = {
	path: string;
	visible: readonly ViolationContract[];
	suppressed: readonly TaskViolationSuppression[];
	maximum_priority: number;
	has_visible_priority: boolean;
	selected_paths: ReadonlySet<string>;
	selected_violations: ReadonlySet<ViolationContract>;
};

export type TaskFilePlanRowsContext = {
	ordered_paths: readonly string[];
	visible_by_path: ReadonlyMap<string, ViolationContract[]>;
	suppressed_by_path: ReadonlyMap<string, TaskViolationSuppression[]>;
	priorities: ReadonlyMap<string, number>;
	selected_paths: ReadonlySet<string>;
	selected_violations: ReadonlySet<ViolationContract>;
};

export type TaskFilePlanPriorityLabels = {
	max_priority: string;
	in_batch_rules: string;
	deferred_rules: string;
};
export type FileLintRunSourceOptions = {
	files: string[];
	repo_root: string;
	names: PythonProjectNames;
	context: LintProjectContextContract;
	ignored_files: ReadonlySet<string>;
	analysis_identity: ProjectAnalysisIdentityContract;
	context_identity: string;
};

export type FileLintRunServices = {
	timers: readonly LintStageTimerContract[];
	coding_rule_linter: CodingRuleLinterContract;
	violation_collector: FileViolationCollectorContract;
	clean_cache_records: boolean;
};

export type TypeScriptWorkerProjectMetadata = {
	project_files: readonly string[];
	entry_files: readonly string[];
	ignored_directories: ReadonlySet<string>;
	directory_files: readonly string[];
	virtual_project: boolean;
};

export enum FileLintWorkerModeKind {
	Project = "project",
	Serial = "serial",
}

/** Responsibilities: _file worker mode contract_. **/
export interface FileLintWorkerModeContract {
	context(): FileLintWorkerModeContext;
	snapshot_scope<Result>(operation: CallableOperation<Result>): Result;
}

/** Responsibilities: _file worker mode data_. **/
export type FileLintWorkerModeContext = {
	kind: FileLintWorkerModeKind;
	metadata: TypeScriptWorkerProjectMetadata;
	scope: ProjectSourceAnalysisOptionsContract;
};

/** Responsibilities: _file lint mode_, _snapshot scope_. **/
export class FileLintWorkerMode implements FileLintWorkerModeContract {
	private readonly _kind: FileLintWorkerModeKind;
	private readonly _metadata: TypeScriptWorkerProjectMetadata;
	private readonly _scope: ProjectSourceAnalysisOptionsContract;

	/** Responsibilities: _file worker mode configuration_. **/
	public constructor(options: FileLintWorkerModeContext) {
		this._kind = options.kind;
		this._metadata = options.metadata;
		this._scope = options.scope;
	}

	/** Responsibilities: _worker mode data_. **/
	public context(): FileLintWorkerModeContext {
		return { kind: this._kind, metadata: this._metadata, scope: this._scope };
	}

	/** Responsibilities: _project snapshot scope_. **/
	public snapshot_scope<Result>(operation: CallableOperation<Result>): Result {
		if (this._kind === FileLintWorkerModeKind.Serial) {
			return operation();
		}
		if (this._scope.capture_snapshots_during === undefined) {
			throw new Error("Project lint mode requires a snapshot-capable project scope.");
		}
		return this._scope.capture_snapshots_during(operation);
	}
}

/** Responsibilities: _file lint execution options_. **/
export type FileLintRunOptions = {
	source: FileLintRunSourceOptions;
	services: FileLintRunServices;
	worker_mode: FileLintWorkerModeContract;
};

export type FileLintAnalysisOptions = {
	state: LintRunState;
	stage_timer: LintStageTimerContract;
	analysis_identity: ProjectAnalysisIdentityContract;
	context_identity: string;
	file_io: IOContract;
	source_io: ProjectSourceIOContract;
};

export type GlobalAnalysisRunOptions = {
	stage: LintAnalysisStage;
	analysis_identity: ProjectAnalysisIdentityContract;
	file_io: IOContract;
};

/** Responsibilities: _project lint execution inputs_. **/

export type ProjectLintExecutionOptions = {
	readonly lint_run_factory: LintRunConfigurationContract;
	readonly file_io: IOContract;
	readonly source_io: ProjectSourceIOContract;
	readonly analysis_identity: ProjectAnalysisIdentityContract;
	readonly options: CliOptions;
	readonly stage_timer: LintStageTimerContract;
};

/** Responsibilities: _project execution contract_. **/
export interface ProjectLintExecutionContract {
	run(): ProjectLintExecutionResult;
}

/** Responsibilities: _project lint execution result_. **/
export type ProjectLintExecutionResult = {
	readonly report: LintRunResult;
	readonly test_target_links: readonly TestTargetLink[];
};

export type CliProjectRunContext = {
	options: CliOptions;
	stage_timer: LintStageTimerContract;
};

export type CliProjectReportContext = {
	options: CliOptions;
	report: LintRunResult;
	stage_timer: LintStageTimerContract;
	task_reporting: TaskReportingContract;
	test_target_links: readonly TestTargetLink[];
};

/** Responsibilities: _CLI lint diagnostics_, _task summary options_. **/
export type CliLintReportRequest = {
	readonly report: LintRunResult;
	readonly options: CliOptions;
	readonly test_target_links: readonly TestTargetLink[];
};

export const UNUSED_SYMBOL_KIND = {
	Class: MODULE_CLASS_KIND,
	Constant: MODULE_CONSTANT_KIND,
	Type: MODULE_TYPE_KIND,
	PublicField: PUBLIC_FIELD_KIND,
	ModuleVariable: MODULE_VARIABLE_KIND,
};

export type UnusedSymbolKind = string;
export type UnusedSymbolOwnerKind = "module" | "class" | "type";

export type UnusedSymbolDefinition = {
	file: string;
	line: number;
	name: string;
	kind: UnusedSymbolKind;
	owner: string;
	owner_kind: UnusedSymbolOwnerKind;
	contract_names: readonly string[];
};

export type UnusedSymbolDefinitionCollection = {
	all: UnusedSymbolDefinition[];
	by_file: Map<string, UnusedSymbolDefinition[]>;
};

export type UnusedImporterNameBuckets = Map<string, UnusedSymbolDefinition[]>;
export type UnusedImporterDefinitionBuckets = Map<string, UnusedImporterNameBuckets>;

export type UnusedSymbolNameBuckets = Map<string, UnusedSymbolDefinition[]>;

export type UnusedDefinitionMatches = readonly UnusedSymbolDefinition[];
export type UnusedSourceDefinitionCache = Map<string, UnusedDefinitionMatches>;
export type UnusedImportedDefinitionCache = Map<string, UnusedSourceDefinitionCache>;
export type UnusedSourceImportFiles = ReadonlySet<string>;
export type UnusedSourceImportCache = Map<string, UnusedSourceImportFiles>;
export type UnusedSymbolAliasMap = ReadonlyMap<string, string>;
export type UnusedSymbolAliasCache = Map<string, UnusedSymbolAliasMap>;
export type UnusedSymbolUsageNames = Set<string>;
export type UnusedSymbolUsageByFile = Map<string, UnusedSymbolUsageNames>;
export type UnusedFieldUsageByOwner = Map<string, UnusedSymbolUsageNames>;
export type UnusedFieldUsageByFile = Map<string, UnusedFieldUsageByOwner>;
export type UnusedFieldOwner = { file: string; owner: string };
export type UnusedFieldOwnerRecord = { file: string; owner: string; source_file: string };
export type UnusedFieldOwnerIndex = Map<string, UnusedFieldOwnerRecord[]>;
export type UnusedTypeFieldIndex = Map<string, UnusedFieldOwner[]>;
export type UnusedParameterInterval = { start: number; end: number };
export type UnusedParameterIntervalIndex = Map<string, UnusedParameterInterval[]>;
export type UnusedParameterIntervalCache = WeakMap<ts.SourceFile, UnusedParameterIntervalIndex>;

export type ProjectContextAssemblyOptions = {
	repo_root: string;
	files: string[];
	texts: ReadonlyMap<string, string>;
	source_files: Map<string, ts.SourceFile>;
	python_batch: PythonSourceBatchPreparation;
	source_preparation: ProjectSourcePreparationContract;
	stage_timer: LintStageTimerContract;
	virtual_project: boolean;
	source_io: ProjectSourceIOContract;
};

export type SourceRecordCreationOptions = {
	repo_root: string;
	files: string[];
	texts: ReadonlyMap<string, string>;
	source_files: Map<string, ts.SourceFile>;
	stage_timer: LintStageTimerContract;
	virtual_project: boolean;
	source_io: ProjectSourceIOContract;
};

export type LintProjectContextSnapshot = {
	repo_root: string;
	files: readonly string[];
	texts: ReadonlyMap<string, string>;
	stage_timer: LintStageTimerContract;
	virtual_project: boolean;
	source_io: ProjectSourceIOContract;
};

export type ProjectContextSourcePreparationOptions = {
	repo_root: string;
	files: string[];
	texts: ReadonlyMap<string, string>;
	stage_timer: LintStageTimerContract;
	virtual_project: boolean;
	source_io: ProjectSourceIOContract;
};

export type PythonSourceBatchPreparation = {
	source_files: PythonSourceFilesContract;
	batch: PythonSourceAstBatch;
};

/** Responsibilities: _project language source preparation_, _AST batch completion_. **/
export interface ProjectSourcePreparationContract {
	typescript_source_files(): Map<string, ts.SourceFile>;
	begin_python_ast(): PythonSourceBatchPreparation;
	complete_python_ast(preparation: PythonSourceBatchPreparation): ReadonlyMap<string, NormalizedAstFile>;
}

export type ProjectSourcePreparationOptions = {
	files: string[];
	texts: ReadonlyMap<string, string>;
	repo_root: string;
	stage_timer: LintStageTimerContract;
	virtual_project: boolean;
	python_ast_parser: PythonAstDataContract;
};

export type ProjectTextSnapshotOptions = {
	repo_root: string;
	files: string[];
	ignore_files: readonly string[];
	provided_texts: ReadonlyMap<string, string>;
	configuration_snapshot_complete: boolean;
	stage_timer: LintStageTimerContract;
	virtual_project: boolean;
	source_io: ProjectSourceIOContract;
};

export type LintReportOptions = {
	repo_root: string;
	ignored_directories: readonly string[];
	stage_timer: LintStageTimerContract;
	inputs: LintInputFiles;
	source_texts: ReadonlyMap<string, string>;
	configuration_snapshot_complete: boolean;
	entry_files: readonly string[];
	project_analysis_enabled: boolean;
};

export type LintRunStateContextOptions = {
	report: LintReportOptions;
	mode: LintReportMode;
	input_file_selector: LintInputFileSelectorContract;
	python_parser: PythonAstDataContract;
	analysis_identity: ProjectAnalysisIdentityContract;
	file_io: IOContract;
	source_io: ProjectSourceIOContract;
};

/** Responsibilities: _project source scope dependencies_. **/
export type ProjectSourceScopeOptions = {
	root: string;
	project_files: readonly string[];
	context: LintProjectContextContract;
	ignored_files: ReadonlySet<string>;
	scanner: ProjectSourceScanContract;
	file_io: IOContract;
	directory_files: DirectoryFileSet;
	project_rule_snapshots: ProjectRuleSnapshots;
};

/** Responsibilities: _worker session state_, _parser capability ownership_. **/
export type LintRunWorkerSessionState = {
	readonly session: PythonAstWorkerSessionContract;
	readonly worker: PythonAstWorkerCapabilityContract;
	readonly parser: PythonAstDataContract;
};

/** Responsibilities: _worker registry inputs_, _parser initialization_. **/
export type LintRunWorkerLifecycleOptions = {
	readonly registry: PythonAstWorkerRegistryContract;
	readonly worker_arguments: string[];
	readonly worker_options: SpawnOptions;
	readonly analysis_identity: ProjectAnalysisIdentityContract;
	readonly file_io: IOContract;
	readonly cache_enabled: boolean;
};

/** Responsibilities: _lint analysis dependencies_, _worker lifecycle access_. **/
export type LintRunConfigurationDependencies = {
	readonly input_file_selector: LintInputFileSelectorContract;
	readonly lint_run_analysis: LintRunAnalysisContract;
	readonly analysis_identity: ProjectAnalysisIdentityContract;
	readonly file_io: IOContract;
	readonly source_io: ProjectSourceIOContract;
};

export type LintRunConfigurationAssemblyResult = {
	readonly dependencies: LintRunConfigurationDependencies;
	readonly worker_lifecycle: LintRunWorkerLifecycleContract;
};

/** Responsibilities: _lint configuration dependency contract_. **/
export interface LintRunConfigurationAssemblyContract {
	assemble(): LintRunConfigurationAssemblyResult;
}

export type AstModelSourceData = {
	language: AstLanguage;
	classes: AstClassNode[];
	functions: AstCallableNode[];
	parse_issues: AstParseIssue[];
	import_issues: AstImportIssue[];
};

export type AstModelAttributeAccessData = {
	attribute_accesses: LineDepth[];
};

export type AstModelReferenceData = {
	symbol_references: NamedLine[];
	literal_references: AstLiteralReference[];
	literal_constants: AstLiteralConstant[];
	call_references: AstCallableReference[];
	type_members: AstTypeMembers;
	named_symbols: NamedSymbol[];
	type_declarations: NamedLine[];
	reference_aliases: AstReferenceAlias[];
};

export type AstModelEmptySourceFields = {
	source: AstModelSourceData;
	references: AstModelAttributeAccessData;
};

export type AstModelEmptyReferenceFields = {
	references: AstModelReferenceData;
};

export enum LintReportMode {
	PROJECT = 0,
	IN_MEMORY_PROJECT = 1,
}
