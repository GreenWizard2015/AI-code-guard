import type { LintInputFiles } from "src/types";
import type { ProjectAnalysisIdentityContract } from "src/protocols";
import type { TypeScriptLintSourceRecord } from "src/core/context/type_script_lint_source_record";
import type { LintStageTimer } from "src/lint_stage_timer";

export type TaskDocuments = {
	output: string;
	issues: string;
	report: string;
};
export type ShortReviewResult = {
	output: string;
	short_file_exists: boolean;
};
export type CompleteCacheObservation = {
	reused: LintInputFiles;
	reused_available: boolean;
	ignore_changed: boolean;
	directory_changed: boolean;
};

export type CacheFixtureOptions = {
	repo_root: string;
	project_files: readonly string[];
	texts: ReadonlyMap<string, string>;
	enabled: boolean;
	analysis_identity: ProjectAnalysisIdentityContract;
};

export type ContextSourceRecordCacheFixtureData = {
	options: CacheFixtureOptions;
	files: string[];
	texts: Map<string, string>;
	records: TypeScriptLintSourceRecord[];
	timer: LintStageTimer;
};

/** Responsibilities: _complete-cache comparison result_. **/
export interface WarmCliCacheResultContract {
	readonly cold_exit_is_failure: boolean;
	readonly warm_exit_is_failure: boolean;
	readonly same_report: boolean;
	readonly cache_exists: boolean;
}
