import { relative } from "node:path";
import { LintExecutionCachePreparer } from "src/core/cache/lint_execution_cache_preparer";
import { EMPTY_SOURCE_TEXTS } from "src/core/constants";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { CliArchitectureReview } from "src/core/support/cli_architecture_review";
import { CliResultReporter } from "src/core/support/cli_result_reporter";
import { CommandLineOptions } from "src/core/support/command_line_options";
import { ReportStatus } from "src/core/support/report_status";
import { TaskRuleDocumentation } from "src/core/support/task/reporting/task_rule_documentation";
import { TaskReporting } from "src/core/support/task_reporting";
import { UnusedCode } from "src/core/unused_code";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { REPORTING_PROJECT_ROOT } from "src/constants";
import { LintStageTimer } from "src/lint_stage_timer";
import type {
	LintProjectContextContract,
	LintStageTimerContract,
	ProjectSourceIOContract,
	TaskReportingContract,
	TaskWorkspaceDocumentsContract,
} from "src/protocols";
import type { CliOptions, LintExecutionReport, LintExitStatus, LintInputFiles, LintRunResult } from "src/types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _CLI option parsing_, _project lint execution_. **/
export class CliApplication {
	private readonly command_line_options: CommandLineOptions;
	private readonly lint_run_factory: LintRunConfiguration;
	private readonly cache_preparer: LintExecutionCachePreparer;
	private readonly unused_code: UnusedCode;
	private readonly file_io: IOContract;
	private readonly source_io: ProjectSourceIOContract;

	/** Responsibilities: _aggregation unused-file unresolved-import diagnostics_. **/
	private append_unused_violations(
		root: string,
		entry_files: readonly string[],
		context: LintProjectContextContract,
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
	private lint_report(
		options: CliOptions,
		stage_timer: LintStageTimerContract,
		inputs: LintInputFiles,
		source_texts: ReadonlyMap<string, string>,
	): LintExecutionReport {
		const execution = stage_timer.measure("startup", () =>
			this.lint_run_factory.lint_report({
				repo_root: options.root,
				ignored_directories: options.ignored_directories,
				stage_timer,
				inputs,
				source_texts,
				entry_files: options.entry_files,
			}),
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

	/** Responsibilities: _lint report_. **/
	private async lint_result(options: CliOptions, stage_timer: LintStageTimerContract): Promise<LintRunResult> {
		if (options.review_agent !== "none" || process.env.NODE_ENV === "test") {
			const inputs = stage_timer.measure("startup.file-discovery", () =>
				this.lint_run_factory.input_files(options.root, options.ignored_directories),
			);
			return this.lint_report(options, stage_timer, inputs, EMPTY_SOURCE_TEXTS).report;
		}
		let prepared = this.cache_preparer.complete_cache(options, stage_timer);
		const cached_result = stage_timer.measure("startup.complete-cache-read", () => prepared.cache.cached_result());
		if (cached_result.available) {
			return cached_result.value;
		}
		prepared = stage_timer.measure("startup.cache-miss-preparation", () =>
			this.cache_preparer.prepare_for_inputs(options, stage_timer, prepared.inputs),
		);
		const report = this.lint_report(options, stage_timer, prepared.inputs, prepared.source_texts).report;
		stage_timer.measure("startup.complete-cache-write", () => prepared.cache.write(report));
		return report;
	}

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

	/** Responsibilities: _project report publication_. **/
	private async project_report(
		options: CliOptions,
		stage_timer: LintStageTimerContract,
		report: LintRunResult,
	): Promise<void> {
		const violations = report.violations;
		const report_status = new ReportStatus(violations);
		const should_fail = stage_timer.measure("process-result", () => report_status.warnings());
		const task_reporting = new TaskReporting(options.root, {
			file_io: this.file_io,
			documentation: new TaskRuleDocumentation(REPORTING_PROJECT_ROOT, this.file_io),
		});
		const architecture_review = new CliArchitectureReview(task_reporting, stage_timer);
		const review_status = await architecture_review.status(options, violations);
		this.report_project_outputs(
			options,
			report,
			stage_timer,
			task_reporting,
			task_reporting.documents,
		);
		this.set_exit_code({ lint_failed: should_fail, review_failed: architecture_review.must_fail(review_status) });
	}

	/** Responsibilities: _CLI IO ownership_, _lint reporting dependencies_. **/
	public constructor(file_io: IOContract, source_io: ProjectSourceIOContract) {
		this.file_io = file_io;
		this.source_io = source_io;
		this.command_line_options = new CommandLineOptions();
		this.lint_run_factory = new LintRunConfiguration(this.source_io, this.file_io);
		this.cache_preparer = new LintExecutionCachePreparer(
			this.lint_run_factory,
			this.file_io,
			this.source_io,
			new ProjectAnalysisIdentity(this.file_io),
		);
		this.unused_code = new UnusedCode();
	}

	/** Responsibilities: _execution project lint execution_. **/
	public async run_project(options: CliOptions, stage_timer: LintStageTimerContract): Promise<void> {
		try {
			const report = await this.lint_result(options, stage_timer);
			await this.project_report(options, stage_timer, report);
		} catch (error) {
			try {
				await this.lint_run_factory.python_ast_worker.close();
			} catch (close_error) {
				void close_error;
			}
			throw error;
		}
		await this.lint_run_factory.python_ast_worker.close();
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
