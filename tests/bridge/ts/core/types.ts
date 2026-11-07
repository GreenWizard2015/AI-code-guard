import type { SpawnOptions } from "node:child_process";
import type { PythonAstWorkerRegistryEntry } from "src/core/python-ast/types";
import type { IOContract } from "src/io/protocols";
import type { LintStageTimer } from "src/lint_stage_timer";
import type { LintInputFiles } from "src/project_analysis_types";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import type { PythonCacheWorker } from "tests/bridge/ts/core/python-cache-worker";

export type PythonAstWorkerLeaseFixtureState = {
	readonly arguments_list: string[];
	readonly options: SpawnOptions;
	readonly key: string;
	readonly worker: PythonCacheWorker;
	readonly registry_entries: ReadonlyMap<string, PythonAstWorkerRegistryEntry>;
};

export type CallableFileIOFactory<FileIO extends IOContract = InMemoryFileIO> = (
	root: string,
	files: Record<string, string>,
) => FileIO;

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
	records: LintSourceRecordData[];
	timer: LintStageTimer;
};

/** Responsibilities: _complete-cache comparison result_. **/
export type WarmCliCacheResult = {
	readonly cold_exit_is_failure: boolean;
	readonly warm_exit_is_failure: boolean;
	readonly same_report: boolean;
	readonly cache_exists: boolean;
};
