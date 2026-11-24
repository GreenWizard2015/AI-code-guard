import { TYPESCRIPT_LANGUAGE } from "src/constants";
import { FileLintWorkerModeKind } from "src/core/types";
import type { FileLintRunSourceOptions } from "src/core/types";
import type {
	FileLintExecution,
	FileLinterWorkerContract,
	FileLinterWorkerCoordinatorOptions,
	TypeScriptWorkerFileViolations,
} from "src/linting/file_linter_worker_coordinator_types";
import { CoordinatedTypeScriptWorkerRequest as WorkerRequest } from "src/linting/file_linter_worker_coordinator_types";
import { TypeScriptFileWorkerPool } from "src/linting/orchestration/runtime/file_linting/typescript_worker/type_script_file_worker_pool";
import { TypeScriptWorkerShardPlanner } from "src/linting/orchestration/runtime/file_linting/worker_coordination/type_script_worker_shard_planner";
import type { FileLinterOptions } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import type {
	CallableTypeScriptWorkerMainWork,
	TypeScriptWorkerRunRequestContract,
} from "src/type_script_file_worker_pool_types";

/** Responsibilities: _TypeScript worker coordination_, _diagnostic ordering_. **/
export class FileLinterWorkerCoordinator {
	private readonly _linter_options: FileLinterOptions;
	private readonly _execution: FileLintExecution;
	private readonly _linter: FileLinterWorkerContract;

	/** Responsibilities: _main-thread TypeScript work_. **/
	private main_shard_results(
		main_files: Iterable<string>,
		worker_shards: readonly (readonly string[])[],
	): ReadonlyMap<string, readonly ViolationContract[]> {
		const worker_pool = new TypeScriptFileWorkerPool();
		try {
			return this.timed_shard_results(() => {
				worker_pool.prepare(worker_shards);
				const main_results = new Map<string, ViolationContract[]>();
				const worker_request = this.worker_request(worker_shards, main_files, main_results);
				return worker_pool.run(worker_request);
			});
		} catch (error) {
			worker_pool.stop();
			throw error;
		}
	}

	/** Responsibilities: _TypeScript worker request_, _shard execution options_. **/
	private worker_request(
		worker_shards: readonly (readonly string[])[],
		main_files: Iterable<string>,
		main_results: Map<string, ViolationContract[]>,
	): TypeScriptWorkerRunRequestContract {
		return new WorkerRequest({
			shards: worker_shards,
			execution: { linter_options: this._linter_options, run_options: this._execution.options },
			main_execution: this._execution,
			main_files,
			main_results,
			linter: this._linter,
		});
	}

	/** Responsibilities: _ordered worker diagnostics_. **/
	private append_worker_results(
		worker_violations: ReadonlyMap<string, readonly ViolationContract[]>,
	): ViolationContract[] {
		const source = this._execution.options.source;
		const violations: ViolationContract[] = [];
		let root_diagnostics_added = false;
		for (const file of source.files) {
			root_diagnostics_added = this.append_ordered_file(
				file,
				source,
				worker_violations,
				violations,
				root_diagnostics_added,
			);
		}
		return violations;
	}

	/** Responsibilities: _single-file worker diagnostic ordering_. **/
	private append_ordered_file(
		file: string,
		source: FileLintRunSourceOptions,
		worker_violations: ReadonlyMap<string, readonly ViolationContract[]>,
		violations: ViolationContract[],
		root_diagnostics_added: boolean,
	): boolean {
		if (source.context.source_record(file).language !== TYPESCRIPT_LANGUAGE) {
			violations.push(...this._linter.lint_file(file, this._execution));
			return root_diagnostics_added;
		}
		if (!root_diagnostics_added) {
			violations.push(...(worker_violations.get("") ?? []));
		}
		violations.push(...(worker_violations.get(file) ?? []));
		return true;
	}

	/** Responsibilities: _TypeScript worker candidates_. **/
	private worker_files(): string[] {
		const source = this._execution.options.source;
		const files: string[] = [];
		for (const file of source.files) {
			if (source.context.source_record(file).language === TYPESCRIPT_LANGUAGE) {
				files.push(file);
			}
		}
		return files;
	}

	/** Responsibilities: _worker shard execution_. **/
	private run_shards(shards: readonly (readonly string[])[]): TypeScriptWorkerFileViolations {
		const shard_iterator = shards.values();
		const main_shard_result = shard_iterator.next();
		if (main_shard_result.done) {
			return { available: false, violations_by_file: new Map() };
		}
		if (main_shard_result.value.length === 0) {
			return { available: false, violations_by_file: new Map() };
		}
		const main_files = this.worker_files();
		const violations_by_file = this.main_shard_results(main_files, [...shard_iterator]);
		return { available: true, violations_by_file };
	}

	/** Responsibilities: _worker shard timing_, _worker shard results_. **/
	private timed_shard_results(
		run_workers: CallableTypeScriptWorkerMainWork,
	): ReadonlyMap<string, readonly ViolationContract[]> {
		const services = this._execution.options.services;
		const timers = services.timers.values();
		const timer = timers.next().value;
		if (timer === undefined) {
			return run_workers();
		}
		return timer.measure("file-analysis.typescript.worker-pool", run_workers);
	}

	/** Responsibilities: _serial file diagnostics_. **/
	private serial_violations(): ViolationContract[] {
		const source = this._execution.options.source;
		const violations: ViolationContract[] = [];
		for (const file of source.files) {
			violations.push(...this._linter.lint_file(file, this._execution));
		}
		return violations;
	}

	/** Responsibilities: _worker coordinator configuration_. **/
	public constructor(options: FileLinterWorkerCoordinatorOptions) {
		this._linter_options = options.linter_options;
		this._execution = options.execution;
		this._linter = options.linter;
	}

	/** Responsibilities: _worker availability_. **/
	public run(): TypeScriptWorkerFileViolations {
		const options = this._execution.options;
		if (options.worker_mode.context().kind !== FileLintWorkerModeKind.Project) {
			return { available: false, violations_by_file: new Map() };
		}
		const planner = new TypeScriptWorkerShardPlanner();
		const worker_files = this.worker_files();
		const shards = planner.shards(worker_files);
		if (shards.length < 2) {
			return { available: false, violations_by_file: new Map() };
		}
		return this.run_shards(shards);
	}

	/** Responsibilities: _file lint diagnostics_. **/
	public violations(): ViolationContract[] {
		const worker_result = this.run();
		if (!worker_result.available) {
			return this.serial_violations();
		}
		return this.append_worker_results(worker_result.violations_by_file);
	}
}
