import { TaskReporting } from 'src/bridge/ts/core/support/task-reporting';
import type { CliOptions } from 'src/bridge/ts/core/types';
import type { LintRunResult } from 'src/bridge/ts/runtime/types';
import { LintStageTimer } from 'src/bridge/ts/core/stage-timing';

/** Responsibilities: _lint results formatting_, _diagnostics and timings writing_. **/
export class CliResultReporter {
	private readonly task_reporting: TaskReporting;

	/** Responsibilities: _diagnostic output writing_. **/
	private write(report: LintRunResult, output: string): void {
		if (report.violations.length === 0) {
			console.log(output);
			return;
		}
		console.warn(output);
	}

	/** Responsibilities: _task reporting initialization_. **/
	public constructor(task_reporting: TaskReporting) {
		this.task_reporting = task_reporting;
	}

	/** Responsibilities: _report lint results_. **/
	public report(
		report: LintRunResult,
		options: CliOptions,
	): void {
		const task_options = { batch_size: options.batch_size, policy: options.policy };
		const output = this.task_reporting.format(report.violations, task_options);
		this.write(report, output);
	}

	/** Responsibilities: _reporting lint results stage_. **/
	public report_with_timings(
		report: LintRunResult,
		options: CliOptions,
		stage_timer: LintStageTimer,
	): void {
		const task_options = { batch_size: options.batch_size, policy: options.policy };
		const output = stage_timer.measure(
			'diagnostics',
			() => this.task_reporting.format(report.violations, task_options),
		);
		this.write(report, [output, stage_timer.format()].join('\n'));
	}
}
