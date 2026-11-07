import { dirname, join, resolve } from "node:path";
import { AI_CODE_GUARD_DIRECTORY } from "src/constants";
import { PerformanceReport } from "src/core/support/reporting/performance_report";
import { PERFORMANCE_DOCUMENT_NAME } from "src/core/support/task/constants";
import type { IOContract } from "src/io/protocols";
import type { LintRunResult } from "src/project_analysis_types";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { TaskReportingFormatContract } from "src/task_protocols";
import type { CliOptions } from "src/task_types";

/** Responsibilities: _lint results formatting_, _diagnostics and performance writing_. **/
export class CliResultReporter {
	private readonly _task_reporting: TaskReportingFormatContract;
	private readonly _root: string;
	private readonly _file_io: IOContract;

	/** Responsibilities: _task reporting initialization_. **/
	public constructor(task_reporting: TaskReportingFormatContract, root: string, file_io: IOContract) {
		this._task_reporting = task_reporting;
		this._root = resolve(root);
		this._file_io = file_io;
	}

	/** Responsibilities: _performance document writing_. **/
	public report_performance(report: LintRunResult, options: CliOptions, stage_timer: LintStageTimerContract): void {
		const performance_report = new PerformanceReport({
			root: options.root,
			files: report.files,
			durations: stage_timer.durations(),
		});
		const file = join(this._root, AI_CODE_GUARD_DIRECTORY, PERFORMANCE_DOCUMENT_NAME);
		const content = performance_report.markdown();
		let output = content;
		if (!content.endsWith("\n")) {
			output = `${content}\n`;
		}
		this._file_io.create_directory(dirname(file));
		this._file_io.file(file).write_text(output);
	}

	/** Responsibilities: _report lint results_. **/
	public report(report: LintRunResult, options: CliOptions): void {
		const task_options = { batch_size: options.batch_size, policy: options.policy, skip_review: options.skip_review };
		const output = this._task_reporting.format(report.violations, task_options);
		if (report.violations.length === 0) {
			console.log(output);
			return;
		}
		console.warn(output);
	}
}
