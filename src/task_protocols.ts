import type { ReportViolation } from "src/reporting_protocols";
import type {
	ReviewAgentRunOptions,
	ReviewStatus,
	TaskReportingOptions,
	TaskBatchReplacementOptions,
	TaskWorkspaceDocument,
} from "src/task_types";
import type { ReviewAgentSelection, TaskReviewRunResult } from "src/types";
import type { TaskFileSelection } from "src/model/types/types";

/** Responsibilities: _diagnostic task formatting_. **/
export interface TaskReportingFormatContract {
	format(violations: readonly ReportViolation[], options: TaskReportingOptions): string;
}

/** Responsibilities: _diagnostic task reporting_. **/
export interface TaskReportingContract extends TaskReportingFormatContract {
	review_requested(violations: readonly ReportViolation[]): boolean;
	review_status(): ReviewStatus;
	run_review_agent(selection: ReviewAgentSelection, options: ReviewAgentRunOptions): Promise<TaskReviewRunResult>;
}

/** Responsibilities: _task workspace operations_. **/
export interface TaskWorkspaceDocumentsContract {
	write_document(document: TaskWorkspaceDocument, content: string): void;
	write_performance(content: string): void;
	path_for_document(document: TaskWorkspaceDocument): string;
	rule_document_path(rule_id: string): string;
}

/** Responsibilities: _task batch replacement_. **/
export interface TaskBatchReplacementContract {
	replace(options: TaskBatchReplacementOptions): void;
}

/** Responsibilities: _task workspace operations_. **/
export interface TaskWorkspaceContract {
	clear_batch(): void;
	prepare_review(): void;
}

/** Responsibilities: _task rule documentation operations_. **/
export interface TaskRuleDocumentationContract {
	validate_rule_documents(): void;
	copy_rule_documents(rule_ids: readonly string[], documents: TaskWorkspaceDocumentsContract): void;
	stage_rule_docs(rule_ids: readonly string[], directory: string, documents: TaskWorkspaceDocumentsContract): void;
}

/** Responsibilities: _task review documentation operations_. **/
export interface TaskReviewDocumentationContract {
	validate_review_documents(): void;
	agent_instruction(review_path: string): string;
}

/** Responsibilities: _task review operations_. **/
export interface TaskReviewContract {
	files(): string[];
	line_count(file: string): number;
	text(file: string): string;
	primary_instruction(): string;
	completed(): boolean;
}

/** Responsibilities: _task review-agent execution_. **/
export interface TaskReviewAgentContract {
	findings_present(): boolean;
	run_parallel(selection: ReviewAgentSelection, options: ReviewAgentRunOptions): Promise<TaskReviewRunResult>;
}

/** Responsibilities: _task violation file selection_. **/
export interface TaskFileSelectorContract {
	select_top_category(violations: readonly ReportViolation[], batch_size: number): TaskFileSelection;
	select_all(violations: readonly ReportViolation[], batch_size: number): TaskFileSelection;
}

/** Responsibilities: _task report formatting_. **/
export interface TaskCleanReportContract {
	format(skip_review: boolean): string;
}

/** Responsibilities: _task issue document writing_. **/
export interface TaskIssueDocumentContract {
	write(
		violations: readonly ReportViolation[],
		review_files: readonly string[],
		documents: ReadonlyMap<TaskWorkspaceDocument, string>,
	): void;
}
