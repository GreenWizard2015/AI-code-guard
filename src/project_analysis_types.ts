import type { LintProjectContextContract, LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceScannerContract } from "src/source_protocols";
import type { ReportViolation, ViolationContract } from "src/reporting_protocols";
import type { GitIgnoreGlobMatcherContract } from "src/runtime_protocols";

export type ProjectNames = {
	project_class_names: ReadonlySet<string>;
	python_class_names: ReadonlySet<string>;
	typescript_class_names: ReadonlySet<string>;
	project_protocol_names: ReadonlySet<string>;
	project_interface_names: ReadonlySet<string>;
	project_contract_names: ReadonlySet<string>;
	project_type_names: ReadonlySet<string>;
};
export type ProjectLanguage = "python" | "typescript";
export type ProjectNameContext = {
	project_files: readonly string[];
	context: LintProjectContextContract;
};
type LintRunFiles = {
	repo_root: string;
	files: string[];
	entry_files: string[];
	ignored_files: ReadonlySet<string>;
	ignored_directories: ReadonlySet<string>;
	project_files: string[];
	markdown_files: string[];
};
type LintRunContext = {
	context: LintProjectContextContract;
	source_texts: ReadonlyMap<string, string>;
	global_cache_enabled: boolean;
	virtual_project: boolean;
};
export type LintRunState = LintRunFiles & ProjectNames & LintRunContext;
export type LintRunResult = { files: string[]; violations: ViolationContract[] };
export type LintInputFiles = {
	files: string[];
	project_files: string[];
	ignored_files: string[];
	markdown_files: string[];
	ignore_files: string[];
};
export type LintAnalysisStage = { state: LintRunState; stage_timer: LintStageTimerContract };
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
	violations: ReportViolation[];
};
export type GlobalAnalysisCacheRecord = {
	cache_version: number;
	context_hash: string;
	selection_hash: string;
	violations: ReportViolation[];
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
	violations: ReportViolation[];
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
	scanner: ProjectSourceScannerContract;
	files: Set<string>;
};
export type DirectoryFileSet = { virtual_project: boolean; files: readonly string[] };
