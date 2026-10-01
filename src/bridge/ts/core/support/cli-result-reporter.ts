import type { LintStageTimerProtocol, TaskReportingProtocol, TaskWorkspaceProtocol } from "src/protocols";
import type { CliOptions } from "src/types";
import type { LintRunResult } from "src/types";

/** Responsibilities: _lint results formatting_, _diagnostics and timings writing_. **/
export class CliResultReporter {
	private readonly task_reporting: TaskReportingProtocol;
	private readonly workspace: TaskWorkspaceProtocol;

	/** Responsibilities: _diagnostic output writing_. **/
	private write(report: LintRunResult, output: string): void {
		if (report.violations.length === 0) {
			console.log(output);
			return;
		}
		console.warn(output);
	}

	/** Responsibilities: _task reporting initialization_. **/
	public constructor(task_reporting: TaskReportingProtocol, workspace: TaskWorkspaceProtocol) {
		this.task_reporting = task_reporting;
		this.workspace = workspace;
	}

	/** Responsibilities: _report lint results_. **/
	public report(report: LintRunResult, options: CliOptions): void {
		const task_options = { batch_size: options.batch_size, policy: options.policy, skip_review: options.skip_review };
		const output = this.task_reporting.format(report.violations, task_options);
		this.workspace.write_lint_output(output);
		this.write(report, output);
	}

	/** Responsibilities: _reporting lint results stage_. **/
	public report_with_timings(report: LintRunResult, options: CliOptions, stage_timer: LintStageTimerProtocol): void {
		const task_options = { batch_size: options.batch_size, policy: options.policy, skip_review: options.skip_review };
		const output = stage_timer.measure("diagnostics", () =>
			this.task_reporting.format(report.violations, task_options),
		);
		const output_with_timings = [output, stage_timer.format()].join("\n");
		this.workspace.write_lint_output(output_with_timings);
		this.write(report, output_with_timings);
	}
}
