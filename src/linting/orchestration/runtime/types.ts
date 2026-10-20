import type { CodingRuleLinterContract, FileViolationCollectorContract, LintStageTimerContract, LintProjectContextContract } from "src/shared_services_protocols";
import type { FileAnalysisCacheContract } from "src/cache_protocols";
import type { LintSourceRecord } from "src/source_types";
import type { PythonProjectNames } from "src/model/types/types";

export type CachedFileOptions = {
	file: string;
	source: LintSourceRecord;
	ignored: boolean;
	stage_timer: LintStageTimerContract;
	cache: FileAnalysisCacheContract;
};

export type FileAnalysisOptions = {
	source: LintSourceRecord;
	ignored: boolean;
	stage_timer: LintStageTimerContract;
	names: PythonProjectNames;
	repo_root: string;
	coding_rule_linter: CodingRuleLinterContract;
	violation_collector: FileViolationCollectorContract;
};

export type FileLintOptions = {
	file: string;
	repo_root: string;
	stage_timer: LintStageTimerContract;
	names: PythonProjectNames;
	context: LintProjectContextContract;
	ignored_files: ReadonlySet<string>;
	cache: FileAnalysisCacheContract;
	coding_rule_linter: CodingRuleLinterContract;
	violation_collector: FileViolationCollectorContract;
};
