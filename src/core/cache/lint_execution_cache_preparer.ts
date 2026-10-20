import { LintExecutionCacheContext } from "src/core/cache/lint_execution_cache_context";
import { LintExecutionCacheLookup } from "src/core/cache/lint_execution_cache_lookup";
import { ProjectSourceSnapshot } from "src/core/cache/project_source_snapshot";
import type { CompleteCachePreparation } from "src/core/cache/types";
import { CACHE_INPUT_CONFIRMATION_STAGE, EMPTY_SOURCE_TEXTS, INPUT_TOPOLOGY_CHANGED_MESSAGE } from "src/core/constants";
import { CACHE_INPUT_STABILITY_ATTEMPTS } from "src/core/constants";
import type { LintInputDiscoveryContract, ProjectSourceIOContract, ProjectSourceSnapshotContract } from "src/source_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { LintInputFiles } from "src/project_analysis_types";
import type { CliOptions } from "src/task_types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _stable source input preparation_, _complete-run cache selection_. **/
export class LintExecutionCachePreparer {
	private readonly lint_input_discovery: LintInputDiscoveryContract;
	private readonly source_snapshot: ProjectSourceSnapshotContract;
	private readonly file_io: IOContract;
	private readonly source_io: ProjectSourceIOContract;
	private readonly analysis_identity: ProjectAnalysisIdentityContract;

	/** Responsibilities: _cache input selection equality_. **/
	private same_inputs(left: LintInputFiles, right: LintInputFiles): boolean {
		if (JSON.stringify(left.files) !== JSON.stringify(right.files)) {
			return false;
		}
		if (JSON.stringify(left.project_files) !== JSON.stringify(right.project_files)) {
			return false;
		}
		if (JSON.stringify(left.ignored_files) !== JSON.stringify(right.ignored_files)) {
			return false;
		}
		if (JSON.stringify(left.markdown_files) !== JSON.stringify(right.markdown_files)) {
			return false;
		}
		return JSON.stringify(left.ignore_files) === JSON.stringify(right.ignore_files);
	}

	/** Responsibilities: _complete cache construction_. **/
	private cache_preparation(
		options: CliOptions,
		inputs: LintInputFiles,
		source_texts: ReadonlyMap<string, string>,
	): CompleteCachePreparation {
		const cache_context = new LintExecutionCacheContext({
			root: options.root,
			inputs,
			options,
			source_texts,
			analysis_identity: this.analysis_identity,
			file_io: this.file_io,
			source_io: this.source_io,
		});
		return { cache: cache_context.lint_cache(), inputs, source_texts };
	}

	/** Responsibilities: _field initialization_. **/
	public constructor(
		lint_input_discovery: LintInputDiscoveryContract,
		file_io: IOContract,
		source_io: ProjectSourceIOContract,
		analysis_identity: ProjectAnalysisIdentityContract,
	) {
		this.lint_input_discovery = lint_input_discovery;
		this.file_io = file_io;
		this.source_io = source_io;
		this.analysis_identity = analysis_identity;
		this.source_snapshot = new ProjectSourceSnapshot(source_io);
	}

	/** Responsibilities: _stable input cache preparation_. **/
	public prepare_for_inputs(
		options: CliOptions,
		stage_timer: LintStageTimerContract,
		inputs: LintInputFiles,
	): CompleteCachePreparation {
		let current_inputs = inputs;
		for (let attempt = 0; attempt < CACHE_INPUT_STABILITY_ATTEMPTS; attempt += 1) {
			const prepared = this.cache_preparation(
				options,
				current_inputs,
				this.source_snapshot.source_texts(current_inputs),
			);
			const confirmed_inputs = stage_timer.measure(CACHE_INPUT_CONFIRMATION_STAGE, () =>
				this.lint_input_discovery.input_files(options.root, options.ignored_directories),
			);
			if (this.same_inputs(current_inputs, confirmed_inputs)) {
				return prepared;
			}
			current_inputs = confirmed_inputs;
		}
		throw new Error(INPUT_TOPOLOGY_CHANGED_MESSAGE);
	}

	/** Responsibilities: _metadata-only complete-run cache candidate_. **/
	public complete_cache(options: CliOptions, stage_timer: LintStageTimerContract): CompleteCachePreparation {
		const cache_lookup = new LintExecutionCacheLookup(options.root, this.file_io);
		const cached_inputs = stage_timer.measure("startup.cache-inputs", () =>
			cache_lookup.reusable_inputs(options.ignored_directories, options),
		);
		if (cached_inputs.available) {
			return this.cache_preparation(options, cached_inputs.value, EMPTY_SOURCE_TEXTS);
		}
		const discovered = stage_timer.measure("startup.cache-input-discovery", () =>
			this.lint_input_discovery.input_files(options.root, options.ignored_directories),
		);
		return this.prepare_for_inputs(options, stage_timer, discovered);
	}
}
