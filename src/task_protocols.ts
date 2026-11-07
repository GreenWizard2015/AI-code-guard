import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import type { IOContract } from "src/io/protocols";
import type { TaskFileSelection } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { ReviewAgentSelection } from "src/task_review_types";
import type { TaskReviewRunResult } from "src/task_review_types";
import type {
	ReviewAgentRunOptions,
	ReviewStatus,
	TaskBatchReplacementOptions,
	TaskReportingOptions,
	TaskWorkspaceDocument,
} from "src/task_types";
import type { CliOptions } from "src/task_types";

/** Responsibilities: _one task issue section_. **/
export type TaskIssueRuleSectionOptions = {
	readonly root: string;
	readonly rule_id: string;
	readonly first: ViolationContract;
	readonly violations: readonly ViolationContract[];
	readonly documents: TaskWorkspaceDocumentsContract;
	readonly file_io: IOContract;
	readonly boundary_failures: SystemFailureClassificationContract;
};

/** Responsibilities: _rule issue section_. **/
export interface TaskIssueRuleSectionContract {
	format(): string;
}

/** Responsibilities: _issue source file context_. **/
export interface TaskIssueSourceFileContract {
	absolute_path(): string;
	directory(): boolean;
	source_line(line: number): string;
}

/** Responsibilities: _one CLI option application_. **/
export type CliOptionApplicationInput = {
	readonly options: CliOptions;
	readonly option: string;
	readonly next_value: string;
	readonly has_next_value: boolean;
};

/** Responsibilities: _CLI argument application_. **/
export interface CliOptionApplicationContract {
	apply(): boolean;
}

/** Responsibilities: _CLI option parsing_. **/
export interface CommandLineOptionsContract {
	value(): CliOptions;
}

/** Responsibilities: _diagnostic task formatting_. **/
export interface TaskReportingFormatContract {
	format(violations: readonly ViolationContract[], options: TaskReportingOptions): string;
}

/** Responsibilities: _lint report rendering_. **/
export interface TaskReportDocumentContract {
	markdown(): string;
	write(): void;
}

/** Responsibilities: _diagnostic task reporting_. **/
export interface TaskReportingContract extends TaskReportingFormatContract {
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
	file(path: string): TaskReviewFileContract;
	primary_instruction(): string;
	completed(): boolean;
}

/** Responsibilities: _review file contract_. **/
export interface TaskReviewFileContract {
	path(): string;
	active(): boolean;
	line_count(): number;
	text(): string;
}

/** Responsibilities: _review archive state_. **/
export interface ResolvedReviewArchiveContract {
	status(file: string): string;
}

/** Responsibilities: _task review-agent execution_. **/
export interface TaskReviewAgentContract {
	findings_present(): boolean;
	run_parallel(selection: ReviewAgentSelection, options: ReviewAgentRunOptions): Promise<TaskReviewRunResult>;
}

/** Responsibilities: _task violation file selection_. **/
export interface TaskFileSelectorContract {
	select_top_category(violations: readonly ViolationContract[], batch_size: number): TaskFileSelection;
	select_all(violations: readonly ViolationContract[], batch_size: number): TaskFileSelection;
}

/** Responsibilities: _task report formatting_. **/
export interface TaskCleanReportContract {
	format(skip_review: boolean): string;
}

/** Responsibilities: _task issue document writing_. **/
export interface TaskIssueDocumentContract {
	write(
		violations: readonly ViolationContract[],
		review_files: readonly string[],
		documents: ReadonlyMap<TaskWorkspaceDocument, string>,
	): void;
}
