import type { LintExecutionCacheContract } from "src/cache_protocols";
import type { IOContract } from "src/io/protocols";
import type { LintInputFiles } from "src/project_analysis_types";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { LintInputDiscoveryContract, ProjectSourceIOContract } from "src/source_protocols";
import type { CliOptions } from "src/task_types";

export type CacheDirectorySnapshot = {
	directories: Set<string>;
	entries: Map<string, string[]>;
};

export type LintExecutionCachePreparerOptions = {
	options: CliOptions;
	stage_timer: LintStageTimerContract;
	lint_input_discovery: LintInputDiscoveryContract;
	file_io: IOContract;
	source_io: ProjectSourceIOContract;
	analysis_identity: ProjectAnalysisIdentityContract;
};

export type CompleteCachePreparation = {
	cache: LintExecutionCacheContract;
	inputs: LintInputFiles;
	source_texts: ReadonlyMap<string, string>;
	snapshot_complete: boolean;
};
export type LintExecutionCacheContextOptions = {
	root: string;
	inputs: LintInputFiles;
	options: CliOptions;
	source_texts: ReadonlyMap<string, string>;
	analysis_identity: ProjectAnalysisIdentityContract;
	file_io: IOContract;
	temporary_write_paths: Set<string>;
	source_io: ProjectSourceIOContract;
	source_snapshot_complete: boolean;
};

/** Responsibilities: _temporary writer identity outcomes_. **/
export type GlobalAnalysisCacheWriterIdentity = {
	readonly recognized: boolean;
	readonly process_id: number;
};

/** Responsibilities: _global cache cleanup request_. **/
export type GlobalAnalysisCacheCleanupRequest = {
	readonly current_record: string;
	readonly remove_records: boolean;
};

/** Responsibilities: _atomic cache publication attempt_. **/
export type CachePublicationAttempt = {
	readonly temporary_path: string;
	readonly record_path: string;
	readonly contents: string;
};

/** Responsibilities: _cache publication cleanup failure handling_. **/
export type CallableCacheCleanupFailureHandler = (message: string) => never;
