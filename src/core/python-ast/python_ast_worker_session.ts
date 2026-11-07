import { PYTHON_AST_WORKER_INACTIVE_LEASE_MESSAGE } from "src/core/python-ast/constants";
import { PythonAstWorkerBatch } from "src/core/python-ast/python_ast_worker_batch";
import type { PythonAstWorkerRegistryEntry, PythonAstWorkerSessionOptions } from "src/core/python-ast/types";
import type {
	PythonAstWorkerBatchContract,
	PythonAstWorkerCapabilityContract,
	PythonAstWorkerContract,
	PythonAstWorkerLeaseOwnerContract,
	PythonAstWorkerSessionContract,
} from "src/python_protocols";

/** Responsibilities: _worker-session access_, _worker lease lifecycle_. **/
export class PythonAstWorkerSession implements PythonAstWorkerSessionContract, PythonAstWorkerCapabilityContract {
	private readonly _workers: Map<string, PythonAstWorkerRegistryEntry>;
	private readonly _key: string;
	private readonly _lease_id: string;
	private readonly _worker_instance: PythonAstWorkerContract;
	private readonly _lease_owner: PythonAstWorkerLeaseOwnerContract;

	/** Responsibilities: _active worker lease access_. **/
	private active_worker(): PythonAstWorkerContract {
		if (!this.active()) {
			throw new Error(PYTHON_AST_WORKER_INACTIVE_LEASE_MESSAGE);
		}
		return this._worker_instance;
	}

	/** Responsibilities: _worker session initialization_. **/
	public constructor(options: PythonAstWorkerSessionOptions) {
		this._workers = options.workers;
		this._key = options.key;
		this._lease_id = options.lease_id;
		this._worker_instance = options.worker_instance;
		this._lease_owner = options.lease_owner;
	}

	/** Responsibilities: _worker lease status_. **/
	public active(): boolean {
		const entry = this._workers.get(this._key);
		return entry !== undefined && entry.leases.has(this._lease_id);
	}

	/** Responsibilities: _worker contract access_. **/
	public worker(): PythonAstWorkerCapabilityContract {
		this.active_worker();
		return this;
	}

	/** Responsibilities: _lease-bound batch lifecycle_. **/
	public batch(batch_id: string, sources: Map<string, string>): PythonAstWorkerBatchContract {
		this.active_worker();
		return new PythonAstWorkerBatch(batch_id, sources, () => this.active_worker());
	}

	/** Responsibilities: _worker session lease state_. **/
	public async close(): Promise<void> {
		await this._lease_owner.release_lease(this._key, this._lease_id);
	}
}
