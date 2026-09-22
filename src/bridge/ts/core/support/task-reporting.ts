import type { ReportViolation, LintTaskPolicy, TaskReportingOptions } from 'src/bridge/ts/core/types';
import { REPORTING_PROJECT_ROOT } from 'src/constants';
import { ReportStatus } from 'src/bridge/ts/core/report-status';
import { TaskFileSelector } from 'src/bridge/ts/core/support/task/task-file-selector';
import { TaskCleanReport } from 'src/bridge/ts/core/support/task/task-clean-report';
import { TaskIssueDocument } from 'src/bridge/ts/core/support/task/task-issue-document';
import { TaskWorkspace } from 'src/bridge/ts/core/support/task/task-workspace';
import { TaskDocumentation } from 'src/bridge/ts/core/support/task/task-documentation';
import { TaskReview } from 'src/bridge/ts/core/support/task/task-review';
import { TaskReportDocument } from 'src/bridge/ts/core/support/task/task-report-document';

/** Responsibilities: _task violations selection_, _output task reporting documents_. **/
export class TaskReporting {
	private readonly workspace: TaskWorkspace;
	private readonly documentation: TaskDocumentation;
	private readonly review: TaskReview;
	private readonly file_selector: TaskFileSelector;
	private readonly clean_report: TaskCleanReport;
	private readonly issue_document: TaskIssueDocument;

	/** Responsibilities: _diagnostic batch formatting_. **/
	private format_batch(violations: readonly ReportViolation[]): string {
		if (violations.length === 0) {
			return this.clean_report.format();
		}
		this.issue_document.write(violations);
		const report_status = new ReportStatus(violations);
		return [report_status.summary(), `See your task in \`${this.workspace.issues_file}\`.`].join('\n');
	}

	/** Responsibilities: _task reporting collaborators initialization_. **/
	public constructor(root: string) {
		this.file_selector = new TaskFileSelector(root);
		this.workspace = new TaskWorkspace(root);
		this.documentation = new TaskDocumentation(REPORTING_PROJECT_ROOT);
		this.review = new TaskReview(root);
		this.clean_report = new TaskCleanReport(this.workspace, this.documentation, this.review);
		this.issue_document = new TaskIssueDocument(root, this.workspace, this.documentation);
	}

	/** Responsibilities: _violations task options formatting_. **/
	public format(violations: readonly ReportViolation[], options: TaskReportingOptions): string {
		return this.format_with_policy(violations, options.batch_size, options.policy);
	}

	/** Responsibilities: _violations by policy selection_, _task documents writing_. **/
	public format_with_policy(
		violations: readonly ReportViolation[],
		batch_size: number,
		policy: LintTaskPolicy,
	): string {
		this.documentation.validate();
		let batch = this.file_selector.select_top_category(violations, batch_size);
		if (policy === 'all') {
			batch = this.file_selector.select_all(violations, batch_size);
		}
		const output = this.format_batch(batch.violations);
		const report_document = new TaskReportDocument(this.workspace, violations);
		report_document.write();
		return [output, `Report in file \`${this.workspace.report_file}\`.`].join('\n');
	}
}
