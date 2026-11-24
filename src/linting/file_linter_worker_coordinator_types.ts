import type { FileAnalysisCacheContract } from "src/cache_protocols";
import type { FileLintRunOptions } from "src/core/types";
import type { FileLinterOptions } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import type {
	TypeScriptWorkerExecution,
	TypeScriptWorkerMainResults,
	TypeScriptWorkerRunRequestContract,
} from "src/type_script_file_worker_pool_types";

/** Responsibilities: _TypeScript worker shard policy_. **/
export const WORKER_SHARD_POLICY = Object.freeze({
	minimum_files: 200,
	invalid_shards_message: "TypeScript worker shards must each contain at least 200 files.",
});

/** Responsibilities: _FileLintExecution_, _TypeScriptWorkerFileViolations_, _FileLinterWorkerContract_, _FileLinterWorkerCoordinatorOptions_. **/
export type FileLintExecution = { options: FileLintRunOptions; cache: FileAnalysisCacheContract };

export type TypeScriptWorkerFileViolations = {
	available: boolean;
	violations_by_file: ReadonlyMap<string, readonly ViolationContract[]>;
};

/** Responsibilities: _worker file linting contract_. **/
export interface FileLinterWorkerContract {
	lint_file(file: string, execution: FileLintExecution): ViolationContract[];
}

/** Responsibilities: _worker coordinator inputs_. **/
export type FileLinterWorkerCoordinatorOptions = {
	linter_options: FileLinterOptions;
	execution: FileLintExecution;
	linter: FileLinterWorkerContract;
};

/** Responsibilities: _worker request configuration_. **/
export type CoordinatedTypeScriptWorkerRequestOptions = {
	readonly shards: readonly (readonly string[])[];
	readonly execution: TypeScriptWorkerExecution;
	readonly main_execution: FileLintExecution;
	readonly main_files: Iterable<string>;
	readonly main_results: Map<string, ViolationContract[]>;
	readonly linter: FileLinterWorkerContract;
};

/** Responsibilities: _coordinator worker shards_, _main-thread lint work_. **/
export class CoordinatedTypeScriptWorkerRequest implements TypeScriptWorkerRunRequestContract {
	private readonly _shard_groups: readonly (readonly string[])[];
	private readonly _worker_execution: TypeScriptWorkerExecution;
	private readonly _main_execution: FileLintExecution;
	private readonly _main_files: readonly string[];
	private readonly _main_results: Map<string, ViolationContract[]>;
	private readonly _linter: FileLinterWorkerContract;

	/** Responsibilities: _main-thread file diagnostic grouping_. **/
	private append_main_result(file: string, violations: readonly ViolationContract[]): void {
		for (const violation of violations) {
			let result_file = file;
			if (violation.file().length === 0) {
				result_file = "";
			}
			const file_violations = this._main_results.get(result_file) ?? [];
			file_violations.push(violation);
			this._main_results.set(result_file, file_violations);
		}
		if (!this._main_results.has(file)) {
			this._main_results.set(file, []);
		}
	}

	/** Responsibilities: _worker request initialization_. **/
	public constructor(options: CoordinatedTypeScriptWorkerRequestOptions) {
		this._shard_groups = options.shards;
		this._worker_execution = options.execution;
		this._main_execution = options.main_execution;
		this._main_files = [...options.main_files];
		this._main_results = options.main_results;
		this._linter = options.linter;
	}

	/** Responsibilities: _worker shard groups_. **/
	public shards(): readonly (readonly string[])[] {
		return this._shard_groups;
	}

	/** Responsibilities: _worker execution context_. **/
	public execution(): TypeScriptWorkerExecution {
		return this._worker_execution;
	}

	/** Responsibilities: _remaining main-thread file linting_, _main-thread result collection_. **/
	public main_work(): TypeScriptWorkerMainResults {
		const main_file_iterator = this._main_files[Symbol.iterator]();
		const first_file_result = main_file_iterator.next();
		if (!first_file_result.done) {
			const { worker_mode } = this._main_execution.options;
			const first_violations = worker_mode.snapshot_scope(() =>
				this._linter.lint_file(first_file_result.value, this._main_execution),
			);
			this.append_main_result(first_file_result.value, first_violations);
		}
		for (const file of main_file_iterator) {
			const violations = this._linter.lint_file(file, this._main_execution);
			this.append_main_result(file, violations);
		}
		return this._main_results;
	}
}
