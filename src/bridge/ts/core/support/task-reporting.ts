import { join } from "node:path";
import { ReportStatus } from "src/bridge/ts/core/report-status";
import { TaskCleanReport } from "src/bridge/ts/core/support/task/task-clean-report";
import { TaskDocumentation } from "src/bridge/ts/core/support/task/task-documentation";
import { TaskFileSelector } from "src/bridge/ts/core/support/task/task-file-selector";
import { TaskIssueDocument } from "src/bridge/ts/core/support/task/task-issue-document";
import { TaskReportDocument } from "src/bridge/ts/core/support/task/task-report-document";
import { TaskReview } from "src/bridge/ts/core/support/task/task-review";
import { TaskWorkspace } from "src/bridge/ts/core/support/task/task-workspace";
import { REPORTING_PROJECT_ROOT } from "src/constants";
import type { LintTaskPolicy, ReportViolation, TaskReportingOptions } from "src/types";

/** Responsibilities: _task violations selection_, _output task reporting documents_. **/
export class TaskReporting {
	public readonly workspace: TaskWorkspace;
	private readonly documentation: TaskDocumentation;
	private readonly review: TaskReview;
	private readonly file_selector: TaskFileSelector;
	private readonly clean_report: TaskCleanReport;
	private readonly issue_document: TaskIssueDocument;

	/** Responsibilities: _diagnostic batch formatting_. **/
	private format_batch(violations: readonly ReportViolation[], skip_review: boolean): string {
		if (violations.length === 0) {
			return this.clean_report.format(skip_review);
		}
		this.issue_document.write(violations);
		const report_status = new ReportStatus(violations);
		return [report_status.summary(), `See your task in \`${this.workspace.issues_file}\`.`].join("\n");
	}

	/** Responsibilities: _task reporting collaborators initialization_. **/
	public constructor(root: string) {
		this.workspace = new TaskWorkspace(root, join(REPORTING_PROJECT_ROOT, "docs", "architecture-review-agent.md"));
		this.file_selector = new TaskFileSelector(root);
		this.documentation = new TaskDocumentation(REPORTING_PROJECT_ROOT);
		this.review = new TaskReview(root);
		this.clean_report = new TaskCleanReport(this.workspace, this.review);
		this.issue_document = new TaskIssueDocument(root, this.workspace, this.documentation);
	}

	/** Responsibilities: _violations task options formatting_. **/
	public format(violations: readonly ReportViolation[], options: TaskReportingOptions): string {
		return this.format_with_policy(violations, options.batch_size, options.policy, options.skip_review);
	}

	/** Responsibilities: _violations by policy selection_, _task documents writing_. **/
	public format_with_policy(
		violations: readonly ReportViolation[],
		batch_size: number,
		policy: LintTaskPolicy,
		skip_review: boolean,
	): string {
		this.documentation.validate();
		let batch = this.file_selector.select_top_category(violations, batch_size);
		if (policy === "all") {
			batch = this.file_selector.select_all(violations, batch_size);
		}
		const output = this.format_batch(batch.violations, skip_review);
		const report_document = new TaskReportDocument(this.workspace, batch.violations);
		report_document.write();
		return [output, `Report in file \`${this.workspace.report_file}\`.`].join("\n");
	}
}
