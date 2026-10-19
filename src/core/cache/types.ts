import type {
	LintExecutionCacheContract,
	ProjectAnalysisIdentityContract,
	ProjectSourceIOContract,
} from "src/protocols";
import type { CliOptions, LintInputFiles } from "src/types";
import type { IOContract } from "src/io/protocols";

export type CompleteCachePreparation = {
	cache: LintExecutionCacheContract;
	inputs: LintInputFiles;
	source_texts: ReadonlyMap<string, string>;
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
