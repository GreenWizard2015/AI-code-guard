import type { SpawnOptions } from "node:child_process";
import { randomUUID } from "node:crypto";
import { PYTHON_AST_WORKER_IO_TIMEOUT_MS, PYTHON_AST_WORKER_REGISTRIES } from "src/core/python-ast/constants";
import { PythonAstWorker } from "src/core/python-ast/python_ast_worker.mjs";
import { PythonAstWorkerSession } from "src/core/python-ast/python_ast_worker_session";
import type { PythonAstWorkerRegistryEntry } from "src/core/python-ast/types";
import type {
	PythonAstWorkerContract,
	PythonAstWorkerLeaseOwnerContract,
	PythonAstWorkerRegistryContract,
	PythonAstWorkerSessionContract,
} from "src/python_protocols";

/** Responsibilities: _worker session registration_, _process worker cleanup_. **/
export class PythonAstWorkerRegistry implements PythonAstWorkerRegistryContract, PythonAstWorkerLeaseOwnerContract {
	private readonly _process_instance: NodeJS.Process;

	/** Responsibilities: _process registry lookup_. **/
	private registry_for(): Map<string, PythonAstWorkerRegistryEntry> {
		let workers = PYTHON_AST_WORKER_REGISTRIES.get(this._process_instance);
		if (workers === undefined) {
			workers = new Map<string, PythonAstWorkerRegistryEntry>();
			PYTHON_AST_WORKER_REGISTRIES.set(this._process_instance, workers);
			this._process_instance.once("exit", () => this.close());
		}
		return workers;
	}

	/** Responsibilities: _worker resource acquisition_. **/
	private acquire_worker(
		workers: Map<string, PythonAstWorkerRegistryEntry>,
		key: string,
		lease_id: string,
		worker_arguments: string[],
		worker_options: SpawnOptions,
	): PythonAstWorkerContract {
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

	/** Responsibilities: _worker registry initialization_. **/
	public constructor(process_instance: NodeJS.Process) {
		this._process_instance = process_instance;
	}

	/** Responsibilities: _Python worker session acquisition_. **/
	public worker_session(worker_arguments: string[], worker_options: SpawnOptions): PythonAstWorkerSessionContract {
		const workers = this.registry_for();
		const key = JSON.stringify([worker_arguments, worker_options]);
		const lease_id = randomUUID();
		const worker_instance = this.acquire_worker(workers, key, lease_id, worker_arguments, worker_options);
		return new PythonAstWorkerSession({
			workers,
			key,
			lease_id,
			worker_instance,
			lease_owner: this,
		});
	}

	/** Responsibilities: _worker lease reclamation_. **/
	public release_lease(key: string, lease_id: string): void {
		const workers = PYTHON_AST_WORKER_REGISTRIES.get(this._process_instance);
		if (workers === undefined) {
			return;
		}
		const entry = workers.get(key);
		if (entry === undefined) {
			return;
		}
		if (!entry.leases.delete(lease_id)) {
			return;
		}
		if (entry.leases.size > 0) {
			return;
		}
		workers.delete(key);
		entry.worker.close();
	}

	/** Responsibilities: _process worker shutdown_. **/
	public close(): void {
		const workers = PYTHON_AST_WORKER_REGISTRIES.get(this._process_instance);
		if (workers === undefined) {
			return;
		}
		PYTHON_AST_WORKER_REGISTRIES.delete(this._process_instance);
		for (const entry of workers.values()) {
			entry.worker.close();
		}
		workers.clear();
	}
}
