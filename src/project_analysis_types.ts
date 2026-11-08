import type { IOContract } from "src/io/protocols";
import type { ReportViolationOptions } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { GitIgnoreGlobMatcherContract } from "src/runtime_protocols";
import type { LintProjectContextContract, LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceScanContract } from "src/source_protocols";

/** Responsibilities: _project symbol-name indexes_. **/
export type ProjectNames = {
	readonly project_class_names: ReadonlySet<string>;
	readonly python_class_names: ReadonlySet<string>;
	readonly typescript_class_names: ReadonlySet<string>;
	readonly project_protocol_names: ReadonlySet<string>;
	readonly project_interface_names: ReadonlySet<string>;
	readonly project_contract_names: ReadonlySet<string>;
	readonly project_type_names: ReadonlySet<string>;
	readonly project_alias_names: ReadonlySet<string>;
	readonly typescript_type_names: ReadonlySet<string>;
	readonly typescript_alias_names: ReadonlySet<string>;
};
export type ProjectLanguage = "python" | "typescript";
export type ProjectLanguageNames = {
	class_names: Set<string>;
	type_names: Set<string>;
	type_alias_names: Set<string>;
};
export type ProjectNameContext = {
	repo_root: string;
	project_files: readonly string[];
	context: LintProjectContextContract;
};
export type LintProjectContextRequest = {
	repo_root: string;
	project_files: readonly string[];
	ignore_files: readonly string[];
	stage_timer: LintStageTimerContract;
	source_texts: ReadonlyMap<string, string>;
	in_memory: boolean;
	configuration_snapshot_complete: boolean;
};
/** Responsibilities: _lint file inventory_. **/
/** Responsibilities: _lint state_. **/
export type LintRunInventory = {
	readonly files: string[];
	readonly entry_files: string[];
	readonly ignored_files: ReadonlySet<string>;
	readonly ignored_directories: ReadonlySet<string>;
	readonly project_files: string[];
	readonly markdown_files: string[];
};
export type LintRunCacheState = {
	readonly global_enabled: boolean;
	readonly project_analysis_rules: boolean;
	readonly virtual_project: boolean;
};
export type LintRunState = {
	readonly repo_root: string;
	readonly ignore_files: readonly string[];
	readonly inventory: LintRunInventory;
	readonly names: ProjectNames;
	readonly context: LintProjectContextContract;
	readonly project_scope: ProjectSourceAnalysisOptions;
	readonly source_texts: ReadonlyMap<string, string>;
	readonly cache: LintRunCacheState;
};

export type LintRunResult = { files: string[]; violations: ViolationContract[] };
export type LintInputFiles = {
	files: string[];
	project_files: string[];
	ignored_files: string[];
	markdown_files: string[];
	ignore_files: string[];
};
export type LintAnalysisStage = {
	state: LintRunState;
	stage_timer: LintStageTimerContract;
	context_identity: string;
};
export type GitIgnorePattern = {
	base_directory: string;
	negated: boolean;
	anchored: boolean;
	directory_only: boolean;
	pattern: string;
	matcher: GitIgnoreGlobMatcherContract;
};
export type GitIgnoreGlobMatchResult = { matched: boolean; visited_states: number };
export type GitIgnorePatternDetails = { value: string; negated: boolean; anchored: boolean; directory_only: boolean };
export type GitIgnoreSourceFile = { file: string; base_directory: string };
export type FileAnalysisCacheRecord = {
	cache_version: number;
	context_hash: string;
	source_file: string;
	source_hash: string;
	ignored: boolean;
	violations: ReportViolationOptions[];
};
export type GlobalAnalysisCacheRecord = {
	cache_version: number;
	context_hash: string;
	selection_hash: string;
	violations: ReportViolationOptions[];
};
export type LintFileFingerprint = {
	file: string;
	size: number;
	mtime_ms: number;
	ctime_ms: number;
	content_hash: string;
};
export type LintDirectoryFingerprint = { directory: string; mtime_ms: number; ctime_ms: number; entries: string[] };
export type LintExecutionCacheRecord = {
	cache_version: number;
	identity: string;
	target_request: string;
	entry_files: string[];
	files: string[];
	violations: ReportViolationOptions[];
	fingerprints: LintFileFingerprint[];
	inputs: LintInputFiles;
	ignored_directories: string[];
	directories: LintDirectoryFingerprint[];
};
export type LintExecutionCacheState = {
	cache_file: string;
	identity: string;
	target_request: string;
	entry_files: string[];
	fingerprints: LintFileFingerprint[];
	inputs: LintInputFiles;
	root: string;
	ignored_directories: string[];
	directories: LintDirectoryFingerprint[];
};
export type CacheState<T> = { available: boolean; value: T };
export type LintInputSelection = {
	repo_root: string;
	target_candidates: readonly string[];
	files: readonly string[];
	repository_project_candidates: string[];
	external_project_candidates: string[];
	visible: ReadonlySet<string>;
};
export type LintInputCandidateState = {
	target_candidates: string[];
	repository_project_candidates: string[];
	external_project_candidates: string[];
	ignored_candidates: string[];
	markdown_candidates: string[];
	visible: ReadonlySet<string>;
	ignore_files: string[];
};
export type LintInputVisibility = { visible: ReadonlySet<string>; ignore_files: string[] };
export type LintRawInputCandidates = {
	target_candidates: string[];
	repository_project_candidates: string[];
	external_project_candidates: string[];
	ignored_candidates: string[];
	markdown_candidates: string[];
};
export type LintProjectCandidates = { repository: string[]; external: string[] };
export type ProjectSourceAnalysisOptions = {
	root: string;
	project_files: readonly string[];
	context: LintProjectContextContract;
	ignored_files: ReadonlySet<string>;
	scanner: ProjectSourceScanContract;
	files: Set<string>;
	file_io: IOContract;
	directory_files: DirectoryFileSet;
};

/** Responsibilities: _global violation collection configuration_. **/
export type GlobalViolationCollectorOptions = {
	repo_root: string;
	project_files: string[];
	project_type_names: ReadonlySet<string>;
	context: LintProjectContextContract;
	ignored_files: ReadonlySet<string>;
	entry_files: readonly string[];
	stage_timer: LintStageTimerContract;
	project_scope: ProjectSourceAnalysisOptions;
};

export type DirectoryFileSet = { virtual_project: boolean; files: readonly string[] };
