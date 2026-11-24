import type { LintExecutionCachePreparerContract } from "src/cache_protocols";
import { LintExecutionCachePreparer } from "src/core/cache/lint_execution/lint_execution_cache_preparer";
import type { CompleteCachePreparation } from "src/core/cache/types";
import { EMPTY_SOURCE_TEXTS, NODE_ENV_VARIABLE } from "src/core/constants";
import type {
	ProjectLintExecutionContract,
	ProjectLintExecutionOptions,
	ProjectLintExecutionResult,
} from "src/core/types";
import { ProjectTestTargetImportPaths } from "src/linting/project_test_target_import_paths";
import type { LintInputFiles } from "src/project_analysis_types";
import type { LintExecutionReport } from "src/runtime_types";
import type { TestTargetLink } from "src/task_types";

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
	private prepared_cache_miss(
		preparer: LintExecutionCachePreparerContract,
		initial: CompleteCachePreparation,
	): CompleteCachePreparation {
		if (initial.snapshot_complete) {
			return initial;
		}
		return this._options.stage_timer.measure("startup.cache-miss-preparation", () =>
			preparer.prepare_for_inputs(initial.inputs),
		);
	}

	/** Responsibilities: _test-target link collection_. **/
	private test_target_links(execution: LintExecutionReport): TestTargetLink[] {
		const import_paths = new ProjectTestTargetImportPaths(this._options.options.root, execution.context);
		return this._options.stage_timer.measure("startup.complete-cache-test-target-links", () =>
			import_paths.test_target_links(),
		);
	}

	/** Responsibilities: _cache-miss result publication_. **/
	private publish_cache_miss(prepared: CompleteCachePreparation): ProjectLintExecutionResult {
		const execution = this.run_inputs(prepared.inputs, prepared.source_texts, prepared.snapshot_complete);
		const test_target_links = this.test_target_links(execution);
		this._options.stage_timer.measure("startup.complete-cache-write", () =>
			prepared.cache.write_execution(execution.report, test_target_links),
		);
		return { report: execution.report, test_target_links };
	}

	/** Responsibilities: _complete-cache analysis_. **/
	private run_cached(): ProjectLintExecutionResult {
		const preparer = this.cache_preparer();
		const prepared = preparer.complete_cache();
		const cached_result = this._options.stage_timer.measure("startup.complete-cache-read", () =>
			prepared.cache.cached_execution(),
		);
		if (cached_result.available) {
			return cached_result.value;
		}
		const miss_prepared = this.prepared_cache_miss(preparer, prepared);
		return this.publish_cache_miss(miss_prepared);
	}

	/** Responsibilities: _project execution initialization_. **/
	public constructor(options: ProjectLintExecutionOptions) {
		this._options = options;
	}

	/** Responsibilities: _cache-aware project analysis_. **/
	public run(): ProjectLintExecutionResult {
		const { options } = this._options;
		const review_requested = options.review_agent !== "none";
		const test_run = process.env[NODE_ENV_VARIABLE] === "test";
		const should_run_directly = review_requested || test_run;
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
