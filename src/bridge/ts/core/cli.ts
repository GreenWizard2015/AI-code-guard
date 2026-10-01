#!/usr/bin/env node
import { relative } from "node:path";
import { LintRunConfiguration } from "src/bridge/ts/core/lint-run-factory";
import { ReportStatus } from "src/bridge/ts/core/report-status";
import { CommandLineOptions } from "src/bridge/ts/core/support/cli-options-parser";
import { CliResultReporter } from "src/bridge/ts/core/support/cli-result-reporter";
import { TaskReporting } from "src/bridge/ts/core/support/task-reporting";
import { UnusedCode } from "src/bridge/ts/core/unused-code";
import type { LintProjectContext, LintStageTimerProtocol } from "src/protocols";
import { LintStageTimer } from "src/stage-timing";
import type { LintRunResult } from "src/types";
import type { CliOptions, LintExecutionReport } from "src/types";

/** Responsibilities: _CLI option parsing_. **/
export class Cli {
	private readonly command_line_options = new CommandLineOptions();
	private readonly lint_run_factory = new LintRunConfiguration();
	private readonly unused_code = new UnusedCode();

	/** Responsibilities: _aggregation unused-file unresolved-import diagnostics_. **/
	private append_unused_violations(
		root: string,
		entry_files: readonly string[],
		context: LintProjectContext,
		report: LintRunResult,
	): void {
		const target_files = new Set(report.files.map((file) => relative(root, file)));
		report.violations.push(
			...this.unused_code
				.collect_unused_files(root, {
					context_state: { available: true, value: context },
					entry_files,
				})
				.filter((violation) => target_files.has(violation.file)),
		);
	}

	/** Responsibilities: _creation lint reporting task_. **/
	private lint_report(options: CliOptions, stage_timer: LintStageTimerProtocol): LintExecutionReport {
		const execution = stage_timer.measure("startup", () =>
			this.lint_run_factory.lint_report(options.root, options.ignored_directories, stage_timer),
		);
		const report = execution.report;
		const statistics = execution.context.statistics();
		if (statistics.source_records !== report.files.length) {
			throw new Error("Lint context and report contain different file counts.");
		}
		stage_timer.measure("unused-files", () =>
			this.append_unused_violations(options.root, options.entry_files, execution.context, report),
		);
		return execution;
	}

	/** Responsibilities: _execution project lint execution_. **/
	public run_project(options: CliOptions, stage_timer: LintStageTimerProtocol): void {
		const { report } = this.lint_report(options, stage_timer);
		const violations = report.violations;
		const report_status = new ReportStatus(violations, report.files);
		const should_fail = stage_timer.measure("process-result", () => report_status.warnings());
		const task_reporting = new TaskReporting(options.root);
		const result_reporter = new CliResultReporter(task_reporting, task_reporting.workspace);
		if (options.timings) {
			result_reporter.report_with_timings(report, options, stage_timer);
		} else {
			result_reporter.report(report, options);
		}
		if (should_fail) {
			process.exitCode = 1;
		}
	}

	/** Responsibilities: _arguments execution parsing processing_. **/
	public run_cli(): void {
		const stage_timer = new LintStageTimer();
		const options = stage_timer.measure("startup", () =>
			stage_timer.measure("startup.cli-options", () => this.command_line_options.from_arguments(process.argv)),
		);
		try {
			this.run_project(options, stage_timer);
		} finally {
			this.lint_run_factory.python_ast_worker.close();
		}
	}
}

{
	const CLI = new Cli();
	CLI.run_cli();
}
