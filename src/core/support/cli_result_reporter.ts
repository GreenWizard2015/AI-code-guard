import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { TaskReportingFormatContract, TaskWorkspaceDocumentsContract } from "src/task_protocols";
import type { CliOptions } from "src/task_types";
import type { LintRunResult } from "src/project_analysis_types";
import { PerformanceReport } from "src/core/support/performance_report";

/** Responsibilities: _lint results formatting_, _diagnostics and performance writing_. **/
export class CliResultReporter {
	private readonly task_reporting: TaskReportingFormatContract;
	private readonly documents: TaskWorkspaceDocumentsContract;

	/** Responsibilities: _diagnostic output writing_. **/
	private write(report: LintRunResult, output: string): void {
		if (report.violations.length === 0) {
			console.log(output);
			return;
		}
		console.warn(output);
	}

	/** Responsibilities: _task reporting initialization_. **/
	public constructor(task_reporting: TaskReportingFormatContract, documents: TaskWorkspaceDocumentsContract) {
		this.task_reporting = task_reporting;
		this.documents = documents;
	}

	/** Responsibilities: _performance document writing_. **/
	public report_performance(report: LintRunResult, options: CliOptions, stage_timer: LintStageTimerContract): void {
		const performance_report = new PerformanceReport({
			root: options.root,
			files: report.files,
			durations: stage_timer.durations(),
		});
		this.documents.write_performance(performance_report.markdown());
	}

	/** Responsibilities: _report lint results_. **/
	public report(report: LintRunResult, options: CliOptions): void {
		const task_options = { batch_size: options.batch_size, policy: options.policy, skip_review: options.skip_review };
		const output = this.task_reporting.format(report.violations, task_options);
		this.write(report, output);
	}
}
