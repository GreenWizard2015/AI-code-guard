import type { IOContract } from "src/io/protocols";
import type { QualityCheckRunOptions } from "test-runner/types";
import type { TaskRuleDocumentationContract } from "src/task_protocols";
import type { ReviewAgentSelection } from "src/types";

export type TaskWorkspaceDocument = "issues" | "report" | "lint-output";
export type TaskBatchReplacementOptions = {
	staged_rules: string;
	rule_ids: readonly string[];
	issues: string;
	documents: ReadonlyMap<TaskWorkspaceDocument, string>;
};
export type CliOptions = {
	ignored_directories: string[];
	entry_files: string[];
	root: string;
	skip_review: boolean;
	force_review: boolean;
	review_cleanup: boolean;
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
	review_cleanup: boolean;
	force_review: boolean;
	review_stages: readonly string[];
};

export type QualityCheckContract = {
	label: string;
	command: string;
	args: readonly string[];
	environment: NodeJS.ProcessEnv;
	supports_review_options: boolean;
	supports_review_agent: boolean;
};

export type QualityCheckDefinitionsContract = {
	all_checks(): QualityCheckContract[];
};

export type QualityCheckProcessContract = {
	run(options: QualityCheckRunOptions): void;
	available_checks(): boolean;
};

/** Responsibilities: _task reporting IO_, _rule-document source injection_. **/
export type TaskReportingDependencies = {
	file_io: IOContract;
	documentation: TaskRuleDocumentationContract;
};
