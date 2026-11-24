import type { AnalyzedCallable } from "src/metrics/types";
import type { ProjectSourceAnalysisOptionsContract } from "src/project_analysis_types";
import type { LintProjectContextContract, LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceScanContract } from "src/source_protocols";
import type { PythonProjectImportContext } from "src/source_types";

/** Responsibilities: _project callable analysis_, _shared parameter reporting_. **/
export type GlobalAnalysisCallableStagesOptions = {
	repo_root: string;
	project_files: readonly string[];
	project_type_names: ReadonlySet<string>;
	context: LintProjectContextContract;
	stage_timer: LintStageTimerContract;
	project_source_scanner: ProjectSourceScanContract;
	import_context: PythonProjectImportContext;
};

/** Responsibilities: _language-specific callable groups_. **/
export type GlobalAnalysisCallableGroups = AnalyzedCallable[][];

/** Responsibilities: _global analysis configuration_. **/
export type GlobalAnalysisStageOptions = {
	readonly repo_root: string;
	readonly project_files: string[];
	readonly project_type_names: ReadonlySet<string>;
	readonly context: LintProjectContextContract;
	readonly entry_files: readonly string[];
	readonly stage_timer: LintStageTimerContract;
	readonly project_scope: ProjectSourceAnalysisOptionsContract;
};
