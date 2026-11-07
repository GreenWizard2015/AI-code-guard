import { relative } from "node:path";
import type { GlobalAnalysisCacheContract } from "src/cache_protocols";
import { GlobalAnalysisCache } from "src/core/cache/global_analysis_cache";
import { NODE_ENV_VARIABLE } from "src/core/constants";
import type { GlobalAnalysisRunOptions } from "src/core/types";
import { GlobalViolationCollector } from "src/linting/orchestration/runtime/global-analysis/diagnostics/global_violation_collector";
import type { LintRunState } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _global analysis stage execution_, _global result cache coordination_. **/
export class GlobalAnalysisRun {
	private readonly _options: GlobalAnalysisRunOptions;
	private readonly _state: LintRunState;
	private readonly _temporary_write_paths: Set<string>;

	/** Responsibilities: _uncached global violation collection_. **/
	private collect_uncached(): ViolationContract[] {
		const { stage } = this._options;
		const state = stage.state;
		const collector = new GlobalViolationCollector({
			repo_root: state.repo_root,
			project_files: state.inventory.project_files,
			project_type_names: state.names.project_type_names,
			context: state.context,
			ignored_files: state.inventory.ignored_files,
			entry_files: state.inventory.entry_files,
			stage_timer: stage.stage_timer,
			project_scope: state.project_scope,
		});
		return collector.collect_for(this.target_files());
	}

	/** Responsibilities: _global cache construction_. **/
	private global_cache(): GlobalAnalysisCacheContract {
		const { stage, analysis_identity, file_io } = this._options;
		const state = stage.state;
		return new GlobalAnalysisCache({
			repo_root: state.repo_root,
			records: state.context.files(),
			files: this.target_files(),
			ignored_files: state.inventory.ignored_files,
			entry_files: state.inventory.entry_files,
			identity: analysis_identity,
			context_identity: stage.context_identity,
			file_io,
			source_io: state.context.source_io(),
			temporary_write_paths: this._temporary_write_paths,
		});
	}

	/** Responsibilities: _cached global violation collection_. **/
	private collect_cached(): ViolationContract[] {
		const { stage } = this._options;
		const cache = this.global_cache();
		const cached = stage.stage_timer.measure("global-analysis.cache-read", () => cache.cached_violations());
		if (cached.available) {
			return [...cached.value];
		}
		const violations = this.collect_uncached();
		stage.stage_timer.measure("global-analysis.cache-write", () => cache.write(violations));
		return violations;
	}

	/** Responsibilities: _global-analysis stage initialization_. **/
	public constructor(options: GlobalAnalysisRunOptions) {
		this._options = options;
		this._state = options.stage.state;
		this._temporary_write_paths = new Set();
	}

	/** Responsibilities: _global-analysis target selection_. **/
	public target_files(): ReadonlySet<string> {
		const { repo_root } = this._state;
		const targets = new Set<string>();
		for (const file of this._state.inventory.files) {
			targets.add(file);
			targets.add(relative(repo_root, file));
		}
		return targets;
	}

	/** Responsibilities: _global analysis execution_. **/
	public collect(): ViolationContract[] {
		const { stage } = this._options;
		if (stage.state.cache.global_enabled && process.env[NODE_ENV_VARIABLE] !== "test") {
			return this.collect_cached();
		}
		return this.collect_uncached();
	}
}
