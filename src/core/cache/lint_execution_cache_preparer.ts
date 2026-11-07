import type { LintExecutionCachePreparerContract } from "src/cache_protocols";
import { LintExecutionCacheContext } from "src/core/cache/lint_execution_cache_context";
import { LintExecutionCacheLookup } from "src/core/cache/lint_execution_cache_lookup";
import { ProjectSourceSnapshot } from "src/core/cache/project_source_snapshot";
import type { CompleteCachePreparation, LintExecutionCachePreparerOptions } from "src/core/cache/types";
import { CACHE_INPUT_CONFIRMATION_STAGE, EMPTY_SOURCE_TEXTS, INPUT_TOPOLOGY_CHANGED_MESSAGE } from "src/core/constants";
import { CACHE_INPUT_STABILITY_ATTEMPTS } from "src/core/constants";
import type { IOContract } from "src/io/protocols";
import type { LintInputFiles } from "src/project_analysis_types";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type {
	LintInputDiscoveryContract,
	ProjectSourceIOContract,
	ProjectSourceSnapshotContract,
} from "src/source_protocols";
import type { CliOptions } from "src/task_types";

/** Responsibilities: _stable source input preparation_, _complete-run cache selection_. **/
export class LintExecutionCachePreparer implements LintExecutionCachePreparerContract {
	private readonly _options: CliOptions;
	private readonly _stage_timer: LintStageTimerContract;
	private readonly _lint_input_discovery: LintInputDiscoveryContract;
	private readonly _source_snapshot: ProjectSourceSnapshotContract;
	private readonly _file_io: IOContract;
	private readonly _source_io: ProjectSourceIOContract;
	private readonly _analysis_identity: ProjectAnalysisIdentityContract;
	private readonly _temporary_write_paths: Set<string>;

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
		inputs: LintInputFiles,
		source_texts: ReadonlyMap<string, string>,
		snapshot_complete = true,
	): CompleteCachePreparation {
		const cache_context = new LintExecutionCacheContext({
			root: this._options.root,
			inputs,
			options: this._options,
			source_texts,
			analysis_identity: this._analysis_identity,
			file_io: this._file_io,
			temporary_write_paths: this._temporary_write_paths,
			source_io: this._source_io,
			source_snapshot_complete: snapshot_complete,
		});
		return { cache: cache_context.lint_cache(), inputs, source_texts, snapshot_complete };
	}

	/** Responsibilities: _field initialization_. **/
	public constructor(configuration: LintExecutionCachePreparerOptions) {
		this._options = configuration.options;
		this._stage_timer = configuration.stage_timer;
		this._lint_input_discovery = configuration.lint_input_discovery;
		this._file_io = configuration.file_io;
		this._source_io = configuration.source_io;
		this._analysis_identity = configuration.analysis_identity;
		this._temporary_write_paths = new Set<string>();
		this._source_snapshot = new ProjectSourceSnapshot(configuration.options.root, configuration.source_io);
	}

	/** Responsibilities: _stable input cache preparation_. **/
	public prepare_for_inputs(inputs: LintInputFiles): CompleteCachePreparation {
		let current_inputs = inputs;
		for (let attempt = 0; attempt < CACHE_INPUT_STABILITY_ATTEMPTS; attempt += 1) {
			const prepared = this.cache_preparation(current_inputs, this._source_snapshot.source_texts(current_inputs));
			const confirmed_inputs = this._stage_timer.measure(CACHE_INPUT_CONFIRMATION_STAGE, () =>
				this._lint_input_discovery.input_files(this._options.root, this._options.ignored_directories),
			);
			const inputs_match = this._stage_timer.measure("startup.cache-input-equality", () =>
				this.same_inputs(current_inputs, confirmed_inputs),
			);
			if (inputs_match) {
				return prepared;
			}
			current_inputs = confirmed_inputs;
		}
		throw new Error(INPUT_TOPOLOGY_CHANGED_MESSAGE);
	}

	/** Responsibilities: _metadata-only complete-run cache candidate_. **/
	public complete_cache(): CompleteCachePreparation {
		const cache_lookup = new LintExecutionCacheLookup(this._options.root, this._file_io);
		const cached_inputs = this._stage_timer.measure("startup.cache-inputs", () =>
			cache_lookup.reusable_inputs(this._options),
		);
		if (cached_inputs.available) {
			return this.cache_preparation(cached_inputs.value, EMPTY_SOURCE_TEXTS, false);
		}
		const discovered = this._stage_timer.measure("startup.cache-input-discovery", () =>
			this._lint_input_discovery.input_files(this._options.root, this._options.ignored_directories),
		);
		return this.prepare_for_inputs(discovered);
	}
}
