import { ReportStatus } from "src/core/support/report_status";
import { LINT_OUTPUT_DOCUMENT } from "src/core/support/task/constants";
import { TaskIssueDocument } from "src/core/support/task/reporting/task_issue_document";
import { TaskReportDocument } from "src/core/support/task/reporting/task_report_document";
import { ResolvedReviewArchive } from "src/core/support/task/resolved_review_archive";
import { TaskCleanReport } from "src/core/support/task/task_clean_report";
import { TaskFileSelector } from "src/core/support/task/task_file_selector";
import { TaskReview } from "src/core/support/task/task_review";
import { TaskReviewAgent } from "src/core/support/task/task_review_agent";
import { TaskWorkspace } from "src/core/support/task/task_workspace";
import { TaskReviewAgentRuntime } from "src/core/support/task_review_agent_runtime";
import type { IOContract } from "src/io/protocols";
import type { ReportViolation } from "src/reporting_protocols";
import type {
	TaskBatchReplacementContract,
	TaskCleanReportContract,
	TaskFileSelectorContract,
	TaskIssueDocumentContract,
	TaskReportingContract,
	TaskReviewAgentContract,
	TaskReviewContract,
	TaskRuleDocumentationContract,
	TaskWorkspaceContract,
	TaskWorkspaceDocumentsContract,
} from "src/task_protocols";
import type { TaskReportingDependencies } from "src/task_types";
import type { ReviewStatus } from "src/task_types";
import type { LintTaskPolicy, TaskReportingOptions, TaskWorkspaceDocument } from "src/task_types";
import type { ReviewAgentRunOptions } from "src/task_types";
import type { ReviewAgentSelection, TaskReviewRunResult } from "src/types";

/** Responsibilities: _task violations selection_, _output task reporting documents_. **/
export class TaskReporting implements TaskReportingContract {
	public readonly documents: TaskWorkspaceDocumentsContract;
	public readonly batch: TaskBatchReplacementContract;
	public readonly workspace: TaskWorkspaceContract;
	private readonly documentation: TaskRuleDocumentationContract;
	private readonly review: TaskReviewContract;
	private readonly review_archive: ResolvedReviewArchive;
	private readonly review_agent: TaskReviewAgentContract;
	private readonly file_selector: TaskFileSelectorContract;
	private readonly clean_report: TaskCleanReportContract;
	private readonly issue_document: TaskIssueDocumentContract;
	private readonly file_io: IOContract;

	/** Responsibilities: _diagnostic batch formatting_. **/
	private format_batch(
		selected_violations: readonly ReportViolation[],
		all_violations: readonly ReportViolation[],
		skip_review: boolean,
		report: string,
	): string {
		let output: string;
		const review_files = this.review.files();
		if (all_violations.length === 0) {
			output = this.clean_report.format(skip_review);
		} else {
			const report_status = new ReportStatus(all_violations);
			output = [report_status.summary(), `See your task in \`${this.documents.path_for_document("issues")}\`.`].join(
				"\n",
			);
		}
		const documents = new Map<TaskWorkspaceDocument, string>([
			["report", report],
			[LINT_OUTPUT_DOCUMENT, output],
		]);
		this.issue_document.write(selected_violations, review_files, documents);
		return output;
	}

	/** Responsibilities: _task reporting collaborators initialization_. **/
	public constructor(root: string, dependencies: TaskReportingDependencies) {
		this.file_io = dependencies.file_io;
		const workspace = new TaskWorkspace(root, this.file_io);
		this.workspace = workspace;
		this.documents = workspace.documents;
		this.batch = workspace.batch;
		this.file_selector = new TaskFileSelector(root);
		this.documentation = dependencies.documentation;
		this.review_archive = new ResolvedReviewArchive(root, this.file_io);
		this.review = new TaskReview(root, this.file_io);
		const review_runtime = new TaskReviewAgentRuntime(root, this.file_io);
		this.review_agent = new TaskReviewAgent({
			root,
			agent_catalog: review_runtime.catalog(),
			hooks: review_runtime.hooks(),
			hook_command: review_runtime.hook_command,
			hook_file: review_runtime.hook_file,
			file_io: this.file_io,
		});
		this.clean_report = new TaskCleanReport(this.review);
		this.issue_document = new TaskIssueDocument(root, this.documents, this.batch, this.documentation, this.file_io);
	}

	/** Responsibilities: _violations task options formatting_. **/
	public format(violations: readonly ReportViolation[], options: TaskReportingOptions): string {
		return this.format_with_policy(violations, options.batch_size, options.policy, options.skip_review);
	}

	/** Responsibilities: _review request status_. **/
	public review_requested(violations: readonly ReportViolation[]): boolean {
		const has_violations = violations.length > 0;
		if (has_violations) {
			return false;
		}
		return !this.review.completed();
	}

	/** Responsibilities: _architecture review state aggregation_. **/
	public review_status(): ReviewStatus {
		return {
			required: false,
			active: this.review.files().length > 0,
			completed: this.review.completed(),
			failed: false,
		};
	}

	/** Responsibilities: _architecture review agent execution_. **/
	public async run_review_agent(
		selection: ReviewAgentSelection,
		options: ReviewAgentRunOptions,
	): Promise<TaskReviewRunResult> {
		this.workspace.prepare_review();
		return this.review_agent.run_parallel(selection, options);
	}

	/** Responsibilities: _violations by policy selection_, _task documents writing_. **/
	public format_with_policy(
		violations: readonly ReportViolation[],
		batch_size: number,
		policy: LintTaskPolicy,
		skip_review: boolean,
	): string {
		this.review_archive.archive_resolved_reviews();
		this.documentation.validate_rule_documents();
		let batch = this.file_selector.select_top_category(violations, batch_size);
		if (policy === "all") {
			batch = this.file_selector.select_all(violations, batch_size);
		}
		const report_document = new TaskReportDocument(this.documents, batch.violations);
		const output = this.format_batch(batch.violations, violations, skip_review, report_document.markdown());
		return [output, `Report in file \`${this.documents.path_for_document("report")}\`.`].join("\n");
	}
}
