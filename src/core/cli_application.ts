import { REPORTING_PROJECT_ROOT } from "src/constants";
import { ProjectLintExecution } from "src/core/lint-run/project_lint_execution";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { CliArchitectureReview } from "src/core/support/cli/cli_architecture_review";
import { CliResultReporter } from "src/core/support/reporting/cli_result_reporter";
import { ReportStatus } from "src/core/support/reporting/report_status";
import { TaskRuleDocumentation } from "src/core/support/task/reporting/task_rule_documentation";
import { TaskReporting } from "src/core/support/task/reporting/workspace/reports/documents/task_reporting";
import type {
	CliLintReportRequest,
	CliProjectReportContext,
	CliProjectRunContext,
	ProjectLintExecutionResult,
} from "src/core/types";
import type { ProjectLintExecutionContract } from "src/core/types";
import type { IOContract } from "src/io/protocols";
import { ProjectAnalysisIdentity } from "src/project_analysis_identity";
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

	/** Responsibilities: _project review status_, _project output reporting_. **/
	private async publish_project_result(
		options: CliOptions,
		stage_timer: LintStageTimerContract,
		report: ProjectLintExecutionResult,
	): Promise<LintExitStatus> {
		const violations = report.report.violations;
		const report_status = new ReportStatus(violations);
		const should_fail = stage_timer.measure("process-result", () => report_status.warnings());
		const task_reporting = new TaskReporting(options.root, {
			file_io: this._file_io,
			documentation: new TaskRuleDocumentation(REPORTING_PROJECT_ROOT, this._file_io),
		});
		const review_state = task_reporting.review_operations();
		const architecture_review = new CliArchitectureReview(review_state, stage_timer);
		const review_status = await architecture_review.status(options, violations);
		this.report_project_outputs({
			options,
			report: report.report,
			stage_timer,
			task_reporting,
			test_target_links: report.test_target_links,
		});
		return { lint_failed: should_fail, review_failed: architecture_review.must_fail(review_status) };
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
			const execution_runner = this.project_execution(run_context);
			const execution = await execution_runner.run();
			return await this.publish_project_result(options, stage_timer, execution);
		} finally {
			await this._lint_run_configuration.close_worker_session();
		}
	}

	/** Responsibilities: _project output reporting_. **/
	public report_project_outputs(report_context: CliProjectReportContext): void {
		const { options, report, stage_timer, task_reporting, test_target_links } = report_context;
		const result_reporter = new CliResultReporter(task_reporting, options.root, this._file_io);
		const lint_request: CliLintReportRequest = { report, options, test_target_links };
		result_reporter.report_lint(lint_request);
		result_reporter.report_performance(report, options, stage_timer);
	}
}
