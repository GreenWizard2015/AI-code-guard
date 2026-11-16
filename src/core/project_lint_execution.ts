import type { LintExecutionCachePreparerContract } from "src/cache_protocols";
import { LintExecutionCachePreparer } from "src/core/cache/lint_execution_cache_preparer";
import { EMPTY_SOURCE_TEXTS, NODE_ENV_VARIABLE } from "src/core/constants";
import type {
	ProjectLintExecutionContract,
	ProjectLintExecutionOptions,
	ProjectLintExecutionResult,
} from "src/core/types";
import { ProjectTestTargetImportPaths } from "src/linting/orchestration/runtime/test-targets/project_test_target_import_paths";
import type { LintInputFiles } from "src/project_analysis_types";
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
	private run_direct(): ProjectLintExecutionResult {
		const { options, stage_timer, lint_run_factory } = this._options;
		const inputs = stage_timer.measure("startup.file-discovery", () =>
			lint_run_factory.input_files(options.root, options.ignored_directories),
		);
		const execution = this.run_inputs(inputs, EMPTY_SOURCE_TEXTS);
		if (options.agent_mode.package_count === 0) {
			return { report: execution.report, test_target_links: [] };
		}
		const import_paths = new ProjectTestTargetImportPaths(options.root, execution.context);
		const test_target_links = import_paths.test_target_links();
		return { report: execution.report, test_target_links };
	}

	/** Responsibilities: _complete-cache analysis_. **/
	private run_cached(): ProjectLintExecutionResult {
		const { stage_timer } = this._options;
		const cache_preparer = this.cache_preparer();
		let prepared = cache_preparer.complete_cache();
		const cached_result = stage_timer.measure("startup.complete-cache-read", () => prepared.cache.cached_result());
		if (cached_result.available) {
			return { report: cached_result.value, test_target_links: [] };
		}
		if (!prepared.snapshot_complete) {
			prepared = stage_timer.measure("startup.cache-miss-preparation", () =>
				cache_preparer.prepare_for_inputs(prepared.inputs),
			);
		}
		const execution = this.run_inputs(prepared.inputs, prepared.source_texts, prepared.snapshot_complete);
		stage_timer.measure("startup.complete-cache-write", () => prepared.cache.write(execution.report));
		return { report: execution.report, test_target_links: [] };
	}

	/** Responsibilities: _project execution initialization_. **/
	public constructor(options: ProjectLintExecutionOptions) {
		this._options = options;
	}

	/** Responsibilities: _cache-aware project analysis_. **/
	public run(): ProjectLintExecutionResult {
		const { options } = this._options;
		const agent_packages_requested = options.agent_mode.package_count > 0;
		const review_requested = options.review_agent !== "none";
		const test_run = process.env[NODE_ENV_VARIABLE] === "test";
		const should_run_directly = agent_packages_requested || review_requested || test_run;
		if (should_run_directly) {
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
