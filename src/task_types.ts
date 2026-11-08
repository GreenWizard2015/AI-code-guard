import type { IOContract } from "src/io/protocols";
import type { TaskRuleDocumentationContract } from "src/task_protocols";
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
	policy: LintTaskPolicy;
};
export type ReviewStatus = {
	required: boolean;
	active: boolean;
	completed: boolean;
	failed: boolean;
};
export type LintExitStatus = { lint_failed: boolean; review_failed: boolean };
export type LintTaskPolicy = "top-category" | "all";
export type TaskReportingOptions = { batch_size: number; policy: LintTaskPolicy; skip_review: boolean };
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
