import {
	MODULE_CLASS_KIND,
	MODULE_CONSTANT_KIND,
	MODULE_TYPE_KIND,
	MODULE_VARIABLE_KIND,
	PUBLIC_FIELD_KIND,
} from "src/constants";
import type { PythonProjectNames } from "src/model/types/types";
import type { ProjectNames } from "src/project_analysis_types";
import type { LintInputFiles } from "src/project_analysis_types";
import type { PythonSourceFilesContract } from "src/python_protocols";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type {
	CodingRuleLinterContract,
	FileViolationCollectorContract,
	LintProjectContextContract,
	LintStageTimerContract,
} from "src/shared_services_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { PythonSourceAstBatch } from "src/types";
import type ts from "typescript";

export type ContextProjectPaths = ReadonlySet<string>;

export type FileLintRunOptions = {
	files: string[];
	repo_root: string;
	names: PythonProjectNames;
	context: LintProjectContextContract;
	ignored_files: ReadonlySet<string>;
	analysis_identity: ProjectAnalysisIdentityContract;
	timers: readonly LintStageTimerContract[];
	coding_rule_linter: CodingRuleLinterContract;
	violation_collector: FileViolationCollectorContract;
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

export type UnusedSymbolNameBuckets = ReadonlyMap<string, readonly UnusedSymbolDefinition[]>;
export type UnusedSymbolFileBuckets = ReadonlyMap<string, UnusedSymbolNameBuckets>;
export type UnusedSourceImportFiles = ReadonlySet<string>;
export type UnusedSourceImportCache = Map<string, UnusedSourceImportFiles>;
export type UnusedSymbolAliasMap = ReadonlyMap<string, string>;
export type UnusedSymbolAliasCache = Map<string, UnusedSymbolAliasMap>;
export type UnusedFieldOwner = { file: string; owner: string };
export type UnusedFieldOwnerRecord = { file: string; owner: string; source_file: string };
export type UnusedFieldOwnerIndex = Map<string, UnusedFieldOwnerRecord[]>;
export type UnusedTypeFieldIndex = Map<string, UnusedFieldOwner[]>;
export type UnusedReceiverTypeByName = Map<string, string>;
export type UnusedReceiverTypeCache = WeakMap<ts.SourceFile, UnusedReceiverTypeByName>;
export type UnusedParameterInterval = { start: number; end: number };
export type UnusedParameterIntervalIndex = Map<string, UnusedParameterInterval[]>;
export type UnusedParameterIntervalCache = WeakMap<ts.SourceFile, UnusedParameterIntervalIndex>;

export type PythonSourceBatchPreparation = {
	source_files: PythonSourceFilesContract;
	batch: PythonSourceAstBatch;
};

export type ProjectContextAssemblyOptions = {
	repo_root: string;
	files: string[];
	texts: ReadonlyMap<string, string>;
	source_files: Map<string, ts.SourceFile>;
	python_batch: PythonSourceBatchPreparation;
	stage_timer: LintStageTimerContract;
	virtual_project: boolean;
	source_io: ProjectSourceIOContract;
};

export type ProjectTextSnapshotOptions = {
	repo_root: string;
	files: string[];
	provided_texts: ReadonlyMap<string, string>;
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
	entry_files: readonly string[];
};

export type LintProjectAnalysis = {
	context: LintProjectContextContract;
	project_names: ProjectNames;
};

export enum LintReportMode {
	PROJECT = 0,
	IN_MEMORY_PROJECT = 1,
}
