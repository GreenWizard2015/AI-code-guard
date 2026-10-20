import { ProjectLintSession } from "src/core/project_lint_session";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { CliArchitectureReview } from "src/core/support/cli_architecture_review";
import { CliResultReporter } from "src/core/support/cli_result_reporter";
import { CommandLineOptions } from "src/core/support/command_line_options";
import { ReportStatus } from "src/core/support/report_status";
import { TaskRuleDocumentation } from "src/core/support/task/reporting/task_rule_documentation";
import { TaskReporting } from "src/core/support/task_reporting";
import { UnusedCode } from "src/core/project-source/unused_code";
import { REPORTING_PROJECT_ROOT } from "src/constants";
import { LintStageTimer } from "src/lint_stage_timer";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { TaskReportingContract, TaskWorkspaceDocumentsContract } from "src/task_protocols";
import type { LintRunResult } from "src/project_analysis_types";
import type { CliOptions, LintExitStatus } from "src/task_types";
import type { LintRunConfigurationContract } from "src/runtime_protocols";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _CLI option parsing_, _project lint execution_. **/
export class CliApplication {
	private readonly command_line_options: CommandLineOptions;
	private readonly lint_session: ProjectLintSession;
	private readonly lint_run_configuration: LintRunConfigurationContract;
	private readonly unused_code: UnusedCode;
	private readonly file_io: IOContract;

	/** Responsibilities: _CLI exit status assignment_. **/
	private set_exit_code(status: LintExitStatus): void {
		if (status.lint_failed || status.review_failed) {
			process.exitCode = 1;
		}
	}

	/** Responsibilities: _project output reporting_. **/
	private report_project_outputs(
		options: CliOptions,
		report: LintRunResult,
		stage_timer: LintStageTimerContract,
		task_reporting: TaskReportingContract,
		documents: TaskWorkspaceDocumentsContract,
	): void {
		const result_reporter = new CliResultReporter(task_reporting, documents);
		result_reporter.report(report, options);
		result_reporter.report_performance(report, options, stage_timer);
	}

	/** Responsibilities: _CLI IO ownership_, _lint reporting dependencies_. **/
	public constructor(file_io: IOContract, source_io: ProjectSourceIOContract) {
		this.file_io = file_io;
		this.command_line_options = new CommandLineOptions();
		this.lint_run_configuration = new LintRunConfiguration(source_io, file_io);
		this.lint_session = new ProjectLintSession(file_io, source_io, this.lint_run_configuration);
		this.unused_code = new UnusedCode();
	}

	/** Responsibilities: _project lint execution_, _report and status publication_. **/
	public async run_project(options: CliOptions, stage_timer: LintStageTimerContract): Promise<void> {
		const report = await this.lint_session.analyze(options, stage_timer, this.unused_code);
		const violations = report.violations;
		const report_status = new ReportStatus(violations);
		const should_fail = stage_timer.measure("process-result", () => report_status.warnings());
		const task_reporting = new TaskReporting(options.root, {
			file_io: this.file_io,
			documentation: new TaskRuleDocumentation(REPORTING_PROJECT_ROOT, this.file_io),
		});
		const architecture_review = new CliArchitectureReview(task_reporting, stage_timer);
		const review_status = await architecture_review.status(options, violations);
		this.report_project_outputs(options, report, stage_timer, task_reporting, task_reporting.documents);
		this.set_exit_code({ lint_failed: should_fail, review_failed: architecture_review.must_fail(review_status) });
	}

	/** Responsibilities: _arguments execution parsing processing_. **/
	public async run_cli(): Promise<void> {
		const stage_timer = new LintStageTimer();
		const options = stage_timer.measure("startup", () =>
			stage_timer.measure("startup.cli-options", () => this.command_line_options.from_arguments(process.argv)),
		);
		await this.run_project(options, stage_timer);
	}
}
