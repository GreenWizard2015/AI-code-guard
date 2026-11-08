import type { SpawnOptions } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
	PYTHON_AST_PROMISE_REJECTED_STATUS,
	PYTHON_AST_WORKER_IO_TIMEOUT_MS,
	PYTHON_AST_WORKER_REGISTRIES,
} from "src/core/python-ast/constants";
import { PythonAstWorker } from "src/core/python-ast/python_ast_worker.mjs";
import { PythonAstWorkerSession } from "src/core/python-ast/python_ast_worker_session";
import type { PythonAstWorkerRegistryEntry } from "src/core/python-ast/types";
import type {
	PythonAstWorkerContract,
	PythonAstWorkerLeaseOwnerContract,
	PythonAstWorkerRegistryContract,
	PythonAstWorkerSessionContract,
} from "src/python_protocols";

/** Responsibilities: _worker lease registration_, _process worker shutdown_. **/
export class PythonAstWorkerRegistry implements PythonAstWorkerRegistryContract, PythonAstWorkerLeaseOwnerContract {
	private readonly _process_instance: NodeJS.Process;

	/** Responsibilities: _process registry lookup_. **/
	private registry_for(): Map<string, PythonAstWorkerRegistryEntry> {
		let workers = PYTHON_AST_WORKER_REGISTRIES.get(this._process_instance);
		if (workers === undefined) {
			workers = new Map<string, PythonAstWorkerRegistryEntry>();
			PYTHON_AST_WORKER_REGISTRIES.set(this._process_instance, workers);
			this._process_instance.once("exit", () => {
				this.close().then(undefined, (error) => {
					this._process_instance.stderr.write(`Python AST worker shutdown failed: ${String(error)}\n`);
				});
			});
		}
		return workers;
	}

	/** Responsibilities: _worker resource acquisition_. **/
	private acquire_worker(
		key: string,
		lease_id: string,
		worker_arguments: string[],
		worker_options: SpawnOptions,
	): PythonAstWorkerContract {
		const workers = this.registry_for();
		let entry = workers.get(key);
		if (entry === undefined) {
			entry = {
				worker: new PythonAstWorker({
					arguments_list: worker_arguments,
					options: worker_options,
					persistent: true,
					io_timeout_ms: PYTHON_AST_WORKER_IO_TIMEOUT_MS,
				}),
				leases: new Set<string>(),
			};
			workers.set(key, entry);
		}
		entry.leases.add(lease_id);
		return entry.worker;
	}

	/** Responsibilities: _worker process lifecycle_. **/
	private async close_worker(worker: PythonAstWorkerContract): Promise<void> {
		const close_completion = Promise.resolve().then(() => worker.close());
		const exit_completion = close_completion.then(
			() => Promise.resolve().then(() => worker.wait_for_exit()),
			() => Promise.resolve().then(() => worker.wait_for_exit()),
		);
		const results = await Promise.allSettled([close_completion, exit_completion]);
		const errors: string[] = [];
		for (const result of results) {
			if (result.status === PYTHON_AST_PROMISE_REJECTED_STATUS) {
				errors.push(String(result.reason));
			}
		}
		if (errors.length > 0) {
			throw new AggregateError(errors, "Python AST worker failed to close.");
		}
	}

	/** Responsibilities: _worker shutdown result processing_. **/
	private async shutdown_results(
		workers: Map<string, PythonAstWorkerRegistryEntry>,
		shutdowns: Promise<string>[],
	): Promise<string[]> {
		const results = await Promise.allSettled(shutdowns);
		const errors: string[] = [];
		for (const result of results) {
			if (result.status === PYTHON_AST_PROMISE_REJECTED_STATUS) {
				errors.push(String(result.reason));
				continue;
			}
			workers.delete(result.value);
		}
		return errors;
	}

	/** Responsibilities: _worker shutdown_, _registry retention_. **/
	private async close_entries(
		workers: Map<string, PythonAstWorkerRegistryEntry>,
		entries: ReadonlyMap<string, PythonAstWorkerRegistryEntry>,
	): Promise<string[]> {
		const shutdowns: Promise<string>[] = [];
		for (const [key, entry] of entries) {
			entry.leases.clear();
			const shutdown = Promise.resolve()
				.then(() => this.close_worker(entry.worker))
				.then(() => key);
			shutdowns.push(shutdown);
		}
		return this.shutdown_results(workers, shutdowns);
	}

	/** Responsibilities: _worker registry initialization_. **/
	public constructor(process_instance: NodeJS.Process) {
		this._process_instance = process_instance;
	}

	/** Responsibilities: _Python worker session acquisition_. **/
	public worker_session(worker_arguments: string[], worker_options: SpawnOptions): PythonAstWorkerSessionContract {
		const workers = this.registry_for();
		const key = JSON.stringify([worker_arguments, worker_options]);
		const lease_id = randomUUID();
		const worker_instance = this.acquire_worker(key, lease_id, worker_arguments, worker_options);
		return new PythonAstWorkerSession({
			workers,
			key,
			lease_id,
			worker_instance,
			lease_owner: this,
		});
	}

	/** Responsibilities: _worker lease reclamation_. **/
	public async release_lease(key: string, lease_id: string): Promise<void> {
		const workers = PYTHON_AST_WORKER_REGISTRIES.get(this._process_instance);
		if (workers === undefined) {
			return;
		}
		const entry = workers.get(key);
		if (entry === undefined) {
			return;
		}
		const lease_removed = entry.leases.delete(lease_id);
		if (!lease_removed || entry.leases.size > 0) {
			return;
		}
		await this.close_worker(entry.worker);
		workers.delete(key);
	}

	/** Responsibilities: _process worker shutdown_. **/
	public async close(): Promise<void> {
		const workers = PYTHON_AST_WORKER_REGISTRIES.get(this._process_instance);
		if (workers === undefined) {
			return;
		}
		const entries = new Map(workers);
		const errors = await this.close_entries(workers, entries);
		if (errors.length > 0) {
			throw new AggregateError(errors, "One or more Python AST workers failed to close.");
		}
	}
}
