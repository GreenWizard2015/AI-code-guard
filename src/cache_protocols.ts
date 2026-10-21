import type { LintRunResult, CacheState } from "src/project_analysis_types";
import type { LintSourceRecord } from "src/source_types";
import type { NormalizedAstFileContract } from "src/types";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";

/** Responsibilities: _cache record validity_, _cache identity matching_. **/
export interface LintExecutionCacheRecordSnapshotContract {
	valid(): boolean;
	identity_matches(identity: string): boolean;
}

/** Responsibilities: _cached lint-result retrieval_, _cached lint-result persistence_. **/
export interface LintExecutionCacheContract {
	cached_result(): CacheState<LintRunResult>;
	write(result: LintRunResult): void;
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
	clean_unused_records(records: readonly LintSourceRecord[]): void;
}

/** Responsibilities: _source-record AST cache operations_. **/
export interface ContextSourceRecordCacheContract {
	clean(): void;
	cached_asts(
		files: readonly string[],
		texts: ReadonlyMap<string, string>,
		stage_timer: LintStageTimerContract,
	): Map<string, NormalizedAstFileContract>;
	write(
		files: readonly string[],
		texts: ReadonlyMap<string, string>,
		records: readonly LintSourceRecord[],
		cached: ReadonlyMap<string, NormalizedAstFileContract>,
		stage_timer: LintStageTimerContract,
	): LintSourceRecord[];
}
