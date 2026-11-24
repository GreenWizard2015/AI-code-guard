import { WORKER_SHARD_POLICY } from "src/linting/file_linter_worker_coordinator_types";
import { TypeScriptWorkerThreads } from "src/linting/orchestration/runtime/file_linting/typescript_worker/type_script_worker_threads";
import { TypeScriptWorkerResultAggregator } from "src/linting/orchestration/runtime/file_linting/worker_coordination/type_script_worker_result_aggregator";
import type { ViolationContract } from "src/reporting_protocols";
import type {
	TypeScriptWorkerExecution,
	TypeScriptWorkerResultAggregatorContract,
	TypeScriptWorkerRunRequestContract,
} from "src/type_script_file_worker_pool_types";
import type { TypeScriptWorkerParseSnapshot } from "src/typescript_file_worker_types";

/** Responsibilities: _TypeScript worker orchestration_, _worker thread lifecycle_. **/
export class TypeScriptFileWorkerPool {
	private readonly _lifecycle: AbortController;
	private readonly _threads: TypeScriptWorkerThreads;
	private readonly _stopped_message: string;

	/** Responsibilities: _shard parser payloads_. **/
	private parse_snapshots(
		execution: TypeScriptWorkerExecution,
		shards: readonly (readonly string[])[],
	): TypeScriptWorkerParseSnapshot[] {
		const { context } = execution.linter_options;
		return shards.map((shard) => {
			return {
				enqueued_at_ms: 0,
				sources: shard.map((file) => {
					const source = context.source_record(file);
					return { file: source.absolute_path, text: source.text };
				}),
			};
		});
	}

	/** Responsibilities: _worker request lifecycle_, _worker result aggregation_. **/
	private execute_request(
		request: TypeScriptWorkerRunRequestContract,
		snapshots: readonly TypeScriptWorkerParseSnapshot[],
		aggregator: TypeScriptWorkerResultAggregatorContract,
	): ReadonlyMap<string, readonly ViolationContract[]> {
		try {
			this._threads.provide_snapshots(snapshots);
			const main_results = request.main_work();
			const worker_results = aggregator.collect(this._threads.results());
			return aggregator.merge(main_results, worker_results);
		} catch (error) {
			this.stop();
			throw error;
		}
	}

	/** Responsibilities: _worker pool dependencies_. **/
	public constructor() {
		this._lifecycle = new AbortController();
		this._threads = new TypeScriptWorkerThreads();
		this._stopped_message = "TypeScript worker pool has stopped.";
	}

	/** Responsibilities: _worker pool preparation_. **/
	public prepare(shards: readonly (readonly string[])[]): void {
		if (this._lifecycle.signal.aborted) {
			throw new Error(this._stopped_message);
		}
		try {
			this._threads.start(shards);
		} catch (error) {
			this.stop();
			throw error;
		}
	}

	/** Responsibilities: _parallel TypeScript file analysis_. **/
	public run(request: TypeScriptWorkerRunRequestContract): ReadonlyMap<string, readonly ViolationContract[]> {
		if (this._lifecycle.signal.aborted) {
			throw new Error(this._stopped_message);
		}
		const shards = request.shards();
		const shards_are_valid =
			shards.length > 0 && shards.every((shard) => shard.length >= WORKER_SHARD_POLICY.minimum_files);
		if (!shards_are_valid) {
			throw new Error(WORKER_SHARD_POLICY.invalid_shards_message);
		}
		const snapshots = this.parse_snapshots(request.execution(), shards);
		const aggregator = new TypeScriptWorkerResultAggregator(request.execution());
		return this.execute_request(request, snapshots, aggregator);
	}

	/** Responsibilities: _worker pool shutdown_. **/
	public stop(): void {
		if (this._lifecycle.signal.aborted) {
			return;
		}
		this._lifecycle.abort();
		this._threads.stop();
	}
}
