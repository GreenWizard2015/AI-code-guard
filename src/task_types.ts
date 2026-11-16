import type { IOContract } from "src/io/protocols";
import type { TaskFileSelection } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { TaskReportDocumentContract, TaskRuleDocumentationContract } from "src/task_protocols";
import type { ReviewAgentSelection } from "src/task_review_types";
import type { QualityCheckRunOptions, TestRunnerRequest } from "test-runner/types";

export type TaskWorkspaceDocument = "issues" | "report" | "lint-output";
export type TaskBatchReplacementOptions = {
	staged_rules: string;
	rule_ids: readonly string[];
	issues: string;
	documents: ReadonlyMap<TaskWorkspaceDocument, string>;
};
export type StaleClaimOwnerSnapshot = {
	readonly owner_path: string;
	readonly exists: boolean;
	readonly text: string;
};
export type CliOptions = {
	ignored_directories: string[];
	entry_files: string[];
	root: string;
	skip_review: boolean;
	force_review: boolean;
	review_agent: ReviewAgentSelection;
	review_stages: string[];
	batch_size: number;
	agent_mode: AgentPackageMode;
	policy: LintTaskPolicy;
};
/** Responsibilities: _CLI option validation_, _validation error reporting_. **/
export interface CliValidationContract {
	valid(): boolean;
	error_message(): string;
}
/** Responsibilities: _CLI option snapshot_, _validation contract_. **/
export interface CliOptionsParseResultContract extends CliValidationContract {
	options(): CliOptions;
}
/** Responsibilities: _CLI option failure_, _project exit status_. **/
export type ReviewStatus = {
	required: boolean;
	active: boolean;
	completed: boolean;
	failed: boolean;
};
export type LintExitStatus = { lint_failed: boolean; review_failed: boolean };
export type LintTaskPolicy = "top-category" | "all";
export const ALL_POLICY: LintTaskPolicy = "all";
export type TestTargetLink = { readonly test_file: string; readonly production_files: readonly string[] };
/** Responsibilities: _package document input_, _snapshot identity_. **/
export type AgentPackageDocumentContext<TPackage> = {
	readonly agent_package: TPackage;
	readonly snapshot_id: string;
};
/** Responsibilities: _package detail input_. **/
export type AgentPackageDetailRequest<TPackage> = {
	readonly agent_package: TPackage;
};
/** Responsibilities: _package summary counts_. **/
export type AgentPackageSummaryCountsRequest = {
	readonly selected_count: number;
	readonly packaged_count: number;
	readonly excluded_count: number;
	readonly deferred_count: number;
	readonly suppressed_count: number;
	readonly unresolved_count: number;
};
/** Responsibilities: _agent package count_, _test target scope_. **/
export type AgentPackageMode = {
	readonly package_count: number;
	readonly test_target_links: readonly TestTargetLink[];
};

/** Responsibilities: _review files_, _clean report text_. **/
export type TaskReportingReviewPreparation = {
	readonly review_files: readonly string[];
	readonly clean_report: string;
};

/** Responsibilities: _task report options_. **/
export type TaskReportingOptions = {
	batch_size: number;
	policy: LintTaskPolicy;
	skip_review: boolean;
};

/** Responsibilities: _agent package task report options_. **/
export type AgentPackageTaskReportingOptions = {
	batch_size: number;
	policy: LintTaskPolicy;
	skip_review: boolean;
	agent_mode: AgentPackageMode;
};
/** Responsibilities: _agent package reporting input_. **/
export type AgentPackageReportingRequest = {
	violations: readonly ViolationContract[];
	options: AgentPackageTaskReportingOptions;
};
/** Responsibilities: _task batch output_, _publication documents_. **/
export type TaskReportingBatchContext = {
	selected_violations: readonly ViolationContract[];
	all_violations: readonly ViolationContract[];
	report_document: TaskReportDocumentContract;
	review_preparation: TaskReportingReviewPreparation;
	extra_output: string;
};
/** Responsibilities: _agent reporting input_, _review preparation_. **/
export type AgentPackageReportContext = {
	request: AgentPackageReportingRequest;
	review_preparation: TaskReportingReviewPreparation;
};
/** Responsibilities: _agent publication input_, _selected package findings_. **/
export type AgentPackagePublicationContext = {
	request: AgentPackageReportingRequest;
	selection: TaskFileSelection;
	review_preparation: TaskReportingReviewPreparation;
};
export type ReviewAgentRunOptions = {
	force_review: boolean;
	review_stages: readonly string[];
};

export type QualityCheckData = {
	label: string;
	command: string;
	args: readonly string[];
	environment: NodeJS.ProcessEnv;
	supports_review_options: boolean;
	supports_review_agent: boolean;
};

/** Responsibilities: _quality check catalog access_. **/
export interface QualityCheckCatalogContract {
	all_checks(): QualityCheckData[];
}

/** Responsibilities: _quality check execution_. **/
export interface QualityCheckRunnerContract {
	run(options: QualityCheckRunOptions): number;
	run_test_request(request: TestRunnerRequest): number;
}

/** Responsibilities: _task reporting IO_, _rule-document source injection_. **/
export type TaskReportingDependencies = {
	file_io: IOContract;
	documentation: TaskRuleDocumentationContract;
};
