import { REPORTING_PROJECT_ROOT } from "src/constants";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { ProjectLintExecution } from "src/core/project_lint_execution";
import { CliArchitectureReview } from "src/core/support/cli_architecture_review";
import { CommandLineOptions } from "src/core/support/command_line_options";
import { CliResultReporter } from "src/core/support/reporting/cli_result_reporter";
import { ReportStatus } from "src/core/support/reporting/report_status";
import { TaskRuleDocumentation } from "src/core/support/task/reporting/task_rule_documentation";
import { TaskReporting } from "src/core/support/task/reporting/workspace/task_reporting";
import type { CliProjectReportContext, CliProjectRunContext } from "src/core/types";
import type { ProjectLintExecutionContract } from "src/core/types";
import type { IOContract } from "src/io/protocols";
import { LintStageTimer } from "src/lint_stage_timer";
import type { LintRunRuntimeContract } from "src/runtime_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { CliOptions, LintExitStatus } from "src/task_types";

/** Responsibilities: _CLI option parsing_, _project lint execution_. **/
export class CliApplication {
	private readonly _lint_run_configuration: LintRunRuntimeContract;
	private readonly _file_io: IOContract;
	private readonly _source_io: ProjectSourceIOContract;
	private readonly _analysis_identity: ProjectAnalysisIdentity;

	/** Responsibilities: _project output reporting_. **/
	private report_project_outputs(report_context: CliProjectReportContext): void {
		const { options, report, stage_timer, task_reporting } = report_context;
		const result_reporter = new CliResultReporter(task_reporting, options.root, this._file_io);
		result_reporter.report(report, options);
		result_reporter.report_performance(report, options, stage_timer);
	}

	/** Responsibilities: _project execution composition_. **/
	private project_execution(run_context: CliProjectRunContext): ProjectLintExecutionContract {
		const { options, stage_timer } = run_context;
		return new ProjectLintExecution({
			lint_run_factory: this._lint_run_configuration,
			file_io: this._file_io,
			source_io: this._source_io,
			analysis_identity: this._analysis_identity,
			options,
			stage_timer,
		});
	}

	/** Responsibilities: _CLI IOContract ownership_, _lint reporting dependencies_. **/
	public constructor(file_io: IOContract, source_io: ProjectSourceIOContract) {
		this._file_io = file_io;
		this._source_io = source_io;
		this._analysis_identity = new ProjectAnalysisIdentity(file_io);
		this._lint_run_configuration = new LintRunConfiguration(source_io, file_io);
	}

	/** Responsibilities: _project lint execution_, _report and status publication_. **/
	public async run_project(options: CliOptions, stage_timer: LintStageTimerContract): Promise<LintExitStatus> {
		const run_context: CliProjectRunContext = { options, stage_timer };
		try {
			const report = await this.project_execution(run_context).run();
			const violations = report.violations;
			const report_status = new ReportStatus(violations);
			const should_fail = stage_timer.measure("process-result", () => report_status.warnings());
			const task_reporting = new TaskReporting(options.root, {
				file_io: this._file_io,
				documentation: new TaskRuleDocumentation(REPORTING_PROJECT_ROOT, this._file_io),
			});
			const architecture_review = new CliArchitectureReview(task_reporting, stage_timer);
			const review_status = await architecture_review.status(options, violations);
			this.report_project_outputs({ options, report, stage_timer, task_reporting });
			return { lint_failed: should_fail, review_failed: architecture_review.must_fail(review_status) };
		} finally {
			await this._lint_run_configuration.close_worker_session();
		}
	}

	/** Responsibilities: _arguments execution parsing processing_. **/
	public async run_cli(arguments_list: readonly string[]): Promise<LintExitStatus> {
		const stage_timer = new LintStageTimer();
		const options = stage_timer.measure("startup", () =>
			stage_timer.measure("startup.cli-options", () => {
				const parsed_options = new CommandLineOptions(arguments_list);
				return parsed_options.value();
			}),
		);
		return this.run_project(options, stage_timer);
	}
}
