import {
	PYTHON_AST_PROMISE_REJECTED_STATUS,
	PYTHON_AST_WORKER_INACTIVE_LEASE_MESSAGE,
} from "src/core/python-ast/constants";
import { PythonAstWorkerBatch } from "src/core/python-ast/python_ast_worker_batch";
import type {
	PythonAstWorkerCloseState,
	PythonAstWorkerRegistryEntry,
	PythonAstWorkerSessionOptions,
} from "src/core/python-ast/types";
import type {
	PythonAstWorkerBatchContract,
	PythonAstWorkerCapabilityContract,
	PythonAstWorkerContract,
	PythonAstWorkerLeaseOwnerContract,
	PythonAstWorkerLeaseResourceContract,
	PythonAstWorkerSessionContract,
} from "src/python_protocols";

/** Responsibilities: _worker session lease_, _worker batch ownership_. **/
export class PythonAstWorkerSession implements PythonAstWorkerSessionContract {
	private readonly _workers: Map<string, PythonAstWorkerRegistryEntry>;
	private readonly _key: string;
	private readonly _lease_id: string;
	private readonly _worker_instance: PythonAstWorkerContract;
	private readonly _lease_owner: PythonAstWorkerLeaseOwnerContract;
	private readonly _pending_batches: Set<PythonAstWorkerBatchContract>;
	private readonly _lease_resources: Set<PythonAstWorkerLeaseResourceContract>;
	private readonly _close_state: PythonAstWorkerCloseState;

	/** Responsibilities: _active worker lease access_. **/
	private active_worker(): PythonAstWorkerContract {
		if (!this.active()) {
			throw new Error(PYTHON_AST_WORKER_INACTIVE_LEASE_MESSAGE);
		}
		return this._worker_instance;
	}

	/** Responsibilities: _cleanup failure aggregation_. **/
	private async cleanup_failures(tasks: Promise<void>[]): Promise<string[]> {
		const results = await Promise.allSettled(tasks);
		const failures: string[] = [];
		for (const result of results) {
			if (result.status === PYTHON_AST_PROMISE_REJECTED_STATUS) {
				failures.push(String(result.reason));
			}
		}
		return failures;
	}

	/** Responsibilities: _pending worker batch cancellation_. **/
	private async cancel_pending_batches(): Promise<string[]> {
		if (!this.active()) {
			this._pending_batches.clear();
			return [];
		}
		const pending_batches = [...this._pending_batches];
		const tasks = pending_batches.map((batch) => Promise.resolve().then(() => batch.cancel()));
		const failures = await this.cleanup_failures(tasks);
		this._pending_batches.clear();
		return failures;
	}

	/** Responsibilities: _lease resource reclamation_. **/
	private async release_resources(): Promise<string[]> {
		const owned_resources = [...this._lease_resources];
		for (const resource of owned_resources) {
			this._worker_instance.unregister_release_resource(resource);
		}
		const releases = owned_resources.map((resource) => Promise.resolve().then(() => resource.release_lease_resource()));
		const errors = await this.cleanup_failures(releases);
		this._lease_resources.clear();
		return errors;
	}

	/** Responsibilities: _lease resource ownership_, _worker lifecycle_. **/
	private async release(): Promise<void> {
		const errors = await this.cancel_pending_batches();
		const resource_errors = await this.release_resources();
		errors.push(...resource_errors);
		this._lease_resources.clear();
		this._worker_instance.unregister_release_resource(this);
		const lease_release = Promise.resolve().then(() => this._lease_owner.release_lease(this._key, this._lease_id));
		const lease_errors = await this.cleanup_failures([lease_release]);
		errors.push(...lease_errors);
		if (errors.length > 0) {
			throw new AggregateError(errors, "Python AST worker session cleanup failed.");
		}
	}

	/** Responsibilities: _session shutdown coordination_. **/
	private begin_close(): Promise<void> {
		this._close_state.started = true;
		this._close_state.completion = this.release();
		return this._close_state.completion;
	}

	/** Responsibilities: _worker session initialization_. **/
	public constructor(options: PythonAstWorkerSessionOptions) {
		this._workers = options.workers;
		this._key = options.key;
		this._lease_id = options.lease_id;
		this._worker_instance = options.worker_instance;
		this._lease_owner = options.lease_owner;
		this._pending_batches = new Set<PythonAstWorkerBatchContract>();
		this._lease_resources = new Set<PythonAstWorkerLeaseResourceContract>();
		this._close_state = { started: false, completion: Promise.resolve() };
		this._worker_instance.register_release_resource(this);
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

	/** Responsibilities: _batch capability creation_. **/
	public batch(batch_id: string, sources: Map<string, string>): PythonAstWorkerBatchContract {
		this.active_worker();
		return new PythonAstWorkerBatch(batch_id, sources, this.active_worker(), this);
	}

	/** Responsibilities: _lease-owned resource registration_. **/
	public register_release_resource(resource: PythonAstWorkerLeaseResourceContract): void {
		this.active_worker();
		this._worker_instance.register_release_resource(resource);
		this._lease_resources.add(resource);
	}

	/** Responsibilities: _lease-owned resource removal_. **/
	public unregister_release_resource(resource: PythonAstWorkerLeaseResourceContract): void {
		this._lease_resources.delete(resource);
	}

	/** Responsibilities: _worker shutdown resource reclamation_. **/
	public release_lease_resource(): void {
		this._lease_resources.clear();
		this._pending_batches.clear();
	}

	/** Responsibilities: _active batch lease validation_. **/
	public assert_active(): void {
		if (!this.active()) {
			throw new Error(PYTHON_AST_WORKER_INACTIVE_LEASE_MESSAGE);
		}
	}

	/** Responsibilities: _pending batch registration_. **/
	public batch_started(batch: PythonAstWorkerBatchContract): void {
		this.active_worker();
		this._pending_batches.add(batch);
	}

	/** Responsibilities: _pending batch removal_. **/
	public batch_finished(batch: PythonAstWorkerBatchContract): void {
		this._pending_batches.delete(batch);
	}

	/** Responsibilities: _session closure_. **/
	public close(): Promise<void> {
		if (this._close_state.started) {
			return this._close_state.completion;
		}
		return this.begin_close();
	}
}
