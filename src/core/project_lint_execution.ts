import type { LintExecutionCachePreparerContract } from "src/cache_protocols";
import { LintExecutionCachePreparer } from "src/core/cache/lint_execution_cache_preparer";
import { EMPTY_SOURCE_TEXTS, NODE_ENV_VARIABLE } from "src/core/constants";
import type { ProjectLintExecutionContract, ProjectLintExecutionOptions } from "src/core/types";
import type { LintInputFiles, LintRunResult } from "src/project_analysis_types";
import type { LintExecutionReport } from "src/runtime_types";

/** Responsibilities: _cache execution_, _project input snapshot_. **/
export class ProjectLintExecution implements ProjectLintExecutionContract {
	private readonly _options: ProjectLintExecutionOptions;

	/** Responsibilities: _run-scoped cache preparation_. **/
	private cache_preparer(): LintExecutionCachePreparerContract {
		const { options, stage_timer, lint_run_factory, file_io, source_io, analysis_identity } = this._options;
		return new LintExecutionCachePreparer({
			options,
			stage_timer,
			lint_input_discovery: lint_run_factory,
			file_io,
			source_io,
			analysis_identity,
		});
	}

	/** Responsibilities: _uncached input selection_. **/
	private run_direct(): LintRunResult {
		const { options, stage_timer, lint_run_factory } = this._options;
		const inputs = stage_timer.measure("startup.file-discovery", () =>
			lint_run_factory.input_files(options.root, options.ignored_directories),
		);
		return this.run_inputs(inputs, EMPTY_SOURCE_TEXTS).report;
	}

	/** Responsibilities: _complete-cache analysis_. **/
	private run_cached(): LintRunResult {
		const { stage_timer } = this._options;
		const cache_preparer = this.cache_preparer();
		let prepared = cache_preparer.complete_cache();
		const cached_result = stage_timer.measure("startup.complete-cache-read", () => prepared.cache.cached_result());
		if (cached_result.available) {
			return cached_result.value;
		}
		if (!prepared.snapshot_complete) {
			prepared = stage_timer.measure("startup.cache-miss-preparation", () =>
				cache_preparer.prepare_for_inputs(prepared.inputs),
			);
		}
		const execution = this.run_inputs(prepared.inputs, prepared.source_texts, prepared.snapshot_complete);
		stage_timer.measure("startup.complete-cache-write", () => prepared.cache.write(execution.report));
		return execution.report;
	}

	/** Responsibilities: _project execution initialization_. **/
	public constructor(options: ProjectLintExecutionOptions) {
		this._options = options;
	}

	/** Responsibilities: _cache-aware project analysis_. **/
	public run(): LintRunResult {
		const { options } = this._options;
		if (options.review_agent !== "none" || process.env[NODE_ENV_VARIABLE] === "test") {
			return this.run_direct();
		}
		return this.run_cached();
	}

	/** Responsibilities: _project snapshot execution_. **/
	public run_inputs(
		inputs: LintInputFiles,
		source_texts: ReadonlyMap<string, string>,
		configuration_snapshot_complete = false,
	): LintExecutionReport {
		const { options, stage_timer, lint_run_factory } = this._options;
		const execution = stage_timer.measure("startup", () =>
			lint_run_factory.lint_report({
				repo_root: options.root,
				ignored_directories: options.ignored_directories,
				stage_timer,
				inputs,
				source_texts,
				configuration_snapshot_complete,
				entry_files: options.entry_files,
				project_analysis_enabled: false,
			}),
		);
		const statistics = execution.context.statistics();
		if (statistics.source_records !== inputs.project_files.length) {
			throw new Error(
				`Lint context and project inputs contain different file counts (${statistics.source_records} and ${inputs.project_files.length}).`,
			);
		}
		return execution;
	}
}
