import { dirname, join, resolve } from "node:path";
import { AI_CODE_GUARD_DIRECTORY } from "src/constants";
import { PerformanceReport } from "src/core/support/reporting/performance_report";
import { PERFORMANCE_DOCUMENT_NAME } from "src/core/support/task/constants";
import type { CliLintReportRequest } from "src/core/types";
import type { IOContract } from "src/io/protocols";
import type { LintRunResult } from "src/project_analysis_types";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { TaskReportingFormatContract } from "src/task_protocols";
import type { AgentPackageTaskReportingOptions, CliOptions, TaskReportingOptions } from "src/task_types";

/** Responsibilities: _lint results formatting_, _diagnostics and performance writing_. **/
export class CliResultReporter {
	private readonly _task_reporting: TaskReportingFormatContract;
	private readonly _root: string;
	private readonly _file_io: IOContract;

	/** Responsibilities: _task options mapping_. **/
	private task_options(options: CliOptions): TaskReportingOptions {
		return {
			batch_size: options.batch_size,
			policy: options.policy,
			skip_review: options.skip_review,
		};
	}

	/** Responsibilities: _task report formatting dispatch_. **/
	private format_task_report(request: CliLintReportRequest, task_options: TaskReportingOptions): string {
		if (request.options.agent_mode.package_count === 0) {
			return this._task_reporting.format(request.report.violations, task_options);
		}
		const agent_options: AgentPackageTaskReportingOptions = {
			...task_options,
			agent_mode: {
				package_count: request.options.agent_mode.package_count,
				test_target_links: request.test_target_links,
			},
		};
		return this._task_reporting.format_agent_packages(request.report.violations, agent_options);
	}

	/** Responsibilities: _task reporting initialization_. **/
	public constructor(task_reporting: TaskReportingFormatContract, root: string, file_io: IOContract) {
		this._task_reporting = task_reporting;
		this._root = resolve(root);
		this._file_io = file_io;
	}

	/** Responsibilities: _lint diagnostic output_. **/
	public report_lint(request: CliLintReportRequest): void {
		const output = this.format_task_report(request, this.task_options(request.options));
		if (request.report.violations.length > 0) {
			console.warn(output);
			return;
		}
		console.log(output);
	}

	/** Responsibilities: _performance document output_. **/
	public report_performance(report: LintRunResult, options: CliOptions, stage_timer: LintStageTimerContract): void {
		const performance_report = new PerformanceReport({
			root: options.root,
			files: report.files,
			durations: stage_timer.durations(),
		});
		const file = join(this._root, AI_CODE_GUARD_DIRECTORY, PERFORMANCE_DOCUMENT_NAME);
		const content = performance_report.markdown();
		let performance_output = content;
		if (!content.endsWith("\n")) {
			performance_output = `${content}\n`;
		}
		this._file_io.create_directory(dirname(file));
		this._file_io.file(file).write_text(performance_output);
	}
}
