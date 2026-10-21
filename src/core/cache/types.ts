import type { LintExecutionCacheContract } from "src/cache_protocols";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { LintInputFiles } from "src/project_analysis_types";
import type { CliOptions } from "src/task_types";
import type { IOContract } from "src/io/protocols";

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
	source_io: ProjectSourceIOContract;
};
