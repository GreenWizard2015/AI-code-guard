import { relative } from "node:path";
import { LintExecutionCachePreparer } from "src/core/cache/lint_execution_cache_preparer";
import { EMPTY_SOURCE_TEXTS } from "src/core/constants";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import type { IOContract } from "src/io/protocols";
import type { LintInputFiles, LintRunResult } from "src/project_analysis_types";
import type { LintRunConfigurationContract } from "src/runtime_protocols";
import type { LintExecutionReport } from "src/runtime_types";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract, UnusedCodeContract } from "src/source_protocols";
import type { CliOptions } from "src/task_types";

/** Responsibilities: _cache-aware project analysis_, _Python worker lifecycle_. **/
export class ProjectLintSession {
	private readonly boundary_failures: BoundaryFailureClassifier;
	private readonly lint_run_factory: LintRunConfigurationContract;
	private readonly cache_preparer: LintExecutionCachePreparer;

	/** Responsibilities: _failed-run worker cleanup_. **/
	private async close_after_failure(): Promise<void> {
		try {
			await this.lint_run_factory.worker_session.close();
		} catch (close_error) {
			if (!this.boundary_failures.system_failure_message(String(close_error))) {
				throw close_error;
			}
			void close_error;
		}
	}

	/** Responsibilities: _unused-file and unresolved-import diagnostics_. **/
	private append_unused_violations(
		unused_code: UnusedCodeContract,
		root: string,
		entry_files: readonly string[],
		context: LintProjectContextContract,
		report: LintRunResult,
	): void {
		const target_files = new Set(report.files.map((file) => relative(root, file)));
		const options = { context_state: { available: true, value: context }, entry_files };
		const unused_violations = unused_code.collect_unused_files(root, options);
		report.violations.push(...unused_violations.filter((violation) => target_files.has(violation.file)));
	}

	/** Responsibilities: _uncached project input analysis_. **/
	private direct_analysis(
		options: CliOptions,
		stage_timer: LintStageTimerContract,
		unused_code: UnusedCodeContract,
	): LintRunResult {
		const inputs = stage_timer.measure("startup.file-discovery", () =>
			this.lint_run_factory.input_files(options.root, options.ignored_directories),
		);
		return this.analyze_inputs(options, stage_timer, inputs, EMPTY_SOURCE_TEXTS, unused_code).report;
	}

	/** Responsibilities: _complete-cache project analysis_. **/
	private cached_analysis(
		options: CliOptions,
		stage_timer: LintStageTimerContract,
		unused_code: UnusedCodeContract,
	): LintRunResult {
		let prepared = this.cache_preparer.complete_cache(options, stage_timer);
		const cached_result = stage_timer.measure("startup.complete-cache-read", () => prepared.cache.cached_result());
		if (cached_result.available) {
			return cached_result.value;
		}
		if (!prepared.snapshot_complete) {
			prepared = stage_timer.measure("startup.cache-miss-preparation", () =>
				this.cache_preparer.prepare_for_inputs(options, stage_timer, prepared.inputs),
			);
		}
		const execution = this.analyze_inputs(options, stage_timer, prepared.inputs, prepared.source_texts, unused_code);
		stage_timer.measure("startup.complete-cache-write", () => prepared.cache.write(execution.report));
		return execution.report;
	}

	/** Responsibilities: _Python worker resource ownership_. **/
	public constructor(
		file_io: IOContract,
		source_io: ProjectSourceIOContract,
		lint_run_factory: LintRunConfigurationContract,
	) {
		this.boundary_failures = new BoundaryFailureClassifier();
		this.lint_run_factory = lint_run_factory;
		this.cache_preparer = new LintExecutionCachePreparer(
			this.lint_run_factory,
			file_io,
			source_io,
			new ProjectAnalysisIdentity(file_io),
		);
	}

	/** Responsibilities: _project input analysis_, _unused diagnostic enrichment_. **/
	public analyze_inputs(
		options: CliOptions,
		stage_timer: LintStageTimerContract,
		inputs: LintInputFiles,
		source_texts: ReadonlyMap<string, string>,
		unused_code: UnusedCodeContract,
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
		if (statistics.source_records !== inputs.project_files.length) {
			throw new Error(
				`Lint context and project inputs contain different file counts (${statistics.source_records} and ${inputs.project_files.length}).`,
			);
		}
		stage_timer.measure("unused-files", () =>
			this.append_unused_violations(unused_code, options.root, options.entry_files, execution.context, report),
		);
		return execution;
	}

	/** Responsibilities: _cache-aware project analysis_, _worker cleanup_. **/
	public async analyze(
		options: CliOptions,
		stage_timer: LintStageTimerContract,
		unused_code: UnusedCodeContract,
	): Promise<LintRunResult> {
		let report: LintRunResult;
		try {
			const bypass_cache = options.review_agent !== "none" || process.env.NODE_ENV === "test";
			if (bypass_cache) {
				report = this.direct_analysis(options, stage_timer, unused_code);
			} else {
				report = this.cached_analysis(options, stage_timer, unused_code);
			}
		} catch (error) {
			await this.close_after_failure();
			throw error;
		}
		await this.lint_run_factory.worker_session.close();
		return report;
	}
}
