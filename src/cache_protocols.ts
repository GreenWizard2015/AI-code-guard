import type { CompleteCachePreparation } from "src/core/cache/types";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { CacheState, CachedLintExecutionResult, LintRunResult } from "src/project_analysis_types";
import type { LintInputFiles } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type { TestTargetLink } from "src/task_types";

/** Responsibilities: _cache record validity_, _cache identity matching_. **/
export interface LintExecutionCacheRecordSnapshotContract {
	valid(): boolean;
	identity_matches(identity: string): boolean;
}

/** Responsibilities: _cached lint-result retrieval_, _cached lint-result persistence_. **/
export interface LintExecutionCacheContract {
	cached_result(): CacheState<LintRunResult>;
	cached_execution(): CacheState<CachedLintExecutionResult>;
	write(result: LintRunResult): void;
	write_execution(report: LintRunResult, test_target_links: readonly TestTargetLink[]): void;
}

/** Responsibilities: _run-scoped complete-cache preparation_. **/
export interface LintExecutionCachePreparerContract {
	prepare_for_inputs(inputs: LintInputFiles): CompleteCachePreparation;
	complete_cache(): CompleteCachePreparation;
}

/** Responsibilities: _cached global-analysis retrieval_, _cached global-analysis persistence_. **/
export interface GlobalAnalysisCacheContract {
	cached_violations(): CacheState<ViolationContract[]>;
	write(violations: readonly ViolationContract[]): void;
}

/** Responsibilities: _file-analysis cache retrieval_, _file-analysis cache persistence_, _file-analysis cache cleanup_. **/
export interface FileAnalysisCacheContract {
	cached_violations(file: string, text: string, ignored: boolean): CacheState<ViolationContract[]>;
	write(file: string, text: string, ignored: boolean, violations: readonly ViolationContract[]): void;
	clean_unused_records(records: readonly LintSourceRecordData[]): void;
}

/** Responsibilities: _source-record AST cache operations_. **/
export interface ContextSourceRecordCacheContract {
	clean(): void;
	cached_asts(
		files: readonly string[],
		texts: ReadonlyMap<string, string>,
		stage_timer: LintStageTimerContract,
	): Map<string, NormalizedAstFile>;
	write(
		files: readonly string[],
		texts: ReadonlyMap<string, string>,
		records: readonly LintSourceRecordData[],
		cached: ReadonlyMap<string, NormalizedAstFile>,
		stage_timer: LintStageTimerContract,
	): LintSourceRecordData[];
}
