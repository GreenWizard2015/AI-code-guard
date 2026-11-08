import { EventEmitter, once } from "node:events";
import type { AstModel } from "src/core/ast_model";
import { PythonAstWorkerBatch } from "src/core/python-ast/python_ast_worker_batch";
import type { PythonAstWorkerResponse } from "src/core/python-ast/types";
import type {
	PythonAstWorkerBatchContract,
	PythonAstWorkerBatchOwnerContract,
	PythonAstWorkerContract,
	PythonAstWorkerLeaseResourceContract,
} from "src/python_protocols";

/** Responsibilities: _worker responses_, _worker requests_. **/
export class PythonCacheWorker implements PythonAstWorkerContract, PythonAstWorkerBatchOwnerContract {
	private readonly _result: ReturnType<AstModel["empty_ast_file"]>;
	private readonly _staged_batches: Map<string, PythonAstWorkerBatchContract>;
	private readonly _cancelled_batches: Set<string>;
	private readonly _pending_batches: Set<PythonAstWorkerBatchContract>;
	private readonly _lease_resources: Set<PythonAstWorkerLeaseResourceContract>;
	private readonly _exit_events: EventEmitter;
	private readonly _close_events: EventEmitter;
	private _closed = false;
	private _close_calls = 0;
	private _close_failures = 0;
	private _exit_deferred = false;
	private _exit_requested = false;
	private _calls = 0;

	/** Responsibilities: _worker lease resource reclamation_. **/
	private release_lease_resources(): void {
		for (const resource of this._lease_resources) {
			resource.release_lease_resource();
		}
		this._lease_resources.clear();
	}

	/** Responsibilities: _worker fixture setup_. **/
	public constructor(result: ReturnType<AstModel["empty_ast_file"]>) {
		this._result = result;
		this._staged_batches = new Map<string, PythonAstWorkerBatchContract>();
		this._cancelled_batches = new Set<string>();
		this._pending_batches = new Set<PythonAstWorkerBatchContract>();
		this._lease_resources = new Set<PythonAstWorkerLeaseResourceContract>();
		this._exit_events = new EventEmitter();
		this._close_events = new EventEmitter();
	}

	/** Responsibilities: _worker batch identity_. **/
	public batch(batch_id: string, sources: Map<string, string>): PythonAstWorkerBatch {
		return new PythonAstWorkerBatch(batch_id, sources, this, this);
	}

	/** Responsibilities: _active batch validation_. **/
	public assert_active(): void {
		if (this._closed) {
			throw new Error("Worker is closed.");
		}
	}

	/** Responsibilities: _pending batch registration_. **/
	public batch_started(batch: PythonAstWorkerBatchContract): void {
		this._pending_batches.add(batch);
	}

	/** Responsibilities: _pending batch removal_. **/
	public batch_finished(batch: PythonAstWorkerBatchContract): void {
		this._pending_batches.delete(batch);
	}

	/** Responsibilities: _lease resource registration_. **/
	public register_release_resource(resource: PythonAstWorkerLeaseResourceContract): void {
		this._lease_resources.add(resource);
	}

	/** Responsibilities: _lease resource removal_. **/
	public unregister_release_resource(resource: PythonAstWorkerLeaseResourceContract): void {
		this._lease_resources.delete(resource);
	}

	/** Responsibilities: _batch AST fixture delivery_. **/
	public batch_result(batch_id: string, sources: Map<string, string>): PythonAstWorkerResponse {
		this._calls += 1;
		const asts = new Map<string, ReturnType<AstModel["empty_ast_file"]>>();
		for (const name of sources.keys()) {
			asts.set(name, this._result);
		}
		return {
			batch_id,
			asts,
			timings: { ast_parse_ms: 0, ast_build_ms: 0, ast_stages: [] },
		};
	}

	/** Responsibilities: _batch request staging_. **/
	public start_batch(batch_id: string, sources: Map<string, string>): void {
		this._staged_batches.set(batch_id, this.batch(batch_id, sources));
	}

	/** Responsibilities: _staged batch delivery_. **/
	public complete_batch(batch_id: string): PythonAstWorkerResponse {
		const batch = this._staged_batches.get(batch_id);
		if (batch === undefined || this._cancelled_batches.has(batch_id)) {
			throw new Error(`Batch ${batch_id} is not pending.`);
		}
		this._staged_batches.delete(batch_id);
		return batch.result();
	}

	/** Responsibilities: _abandoned batch response consumption_. **/
	public cancel_batch(batch_id: string): void {
		this._staged_batches.delete(batch_id);
		this._cancelled_batches.add(batch_id);
	}

	/** Responsibilities: _worker fixture lifecycle_. **/
	public close(): void {
		this._close_calls += 1;
		this._close_events.emit("close-request");
		try {
			for (const batch_id of this._staged_batches.keys()) {
				this.cancel_batch(batch_id);
			}
			if (this._close_failures > 0) {
				this._close_failures -= 1;
				this._exit_requested = true;
				if (!this._exit_deferred) {
					this.complete_exit();
				}
				throw new Error("injected worker close failure");
			}
			this._exit_requested = true;
			if (!this._exit_deferred) {
				this.complete_exit();
			}
		} finally {
			this.release_lease_resources();
		}
	}

	/** Responsibilities: _worker process completion_. **/
	public wait_for_exit(): Promise<void> {
		if (this._closed) {
			return Promise.resolve();
		}
		return once(this._exit_events, "exit").then(() => undefined);
	}

	/** Responsibilities: _worker termination request_. **/
	public async wait_for_close_request(): Promise<void> {
		await once(this._close_events, "close-request");
	}

	/** Responsibilities: _worker process state_. **/
	public has_exited(): boolean {
		return this._closed;
	}

	/** Responsibilities: _delayed worker exit setup_. **/
	public defer_exit(): void {
		this._exit_deferred = true;
	}

	/** Responsibilities: _worker exit completion_. **/
	public complete_exit(): void {
		this._closed = true;
		this._exit_events.emit("exit");
	}

	/** Responsibilities: _injected shutdown failure_. **/
	public fail_close_times(count: number): void {
		this._close_failures = count;
	}

	/** Responsibilities: _worker shutdown accounting_. **/
	public close_call_count(): number {
		return this._close_calls;
	}

	/** Responsibilities: _cancelled batch identifiers_. **/
	public cancelled_batch_ids(): string[] {
		return [...this._cancelled_batches];
	}

	/** Responsibilities: _worker exit request state_. **/
	public exit_requested(): boolean {
		return this._exit_requested;
	}

	/** Responsibilities: _worker request count observation_. **/
	public call_count(): number {
		return this._calls;
	}
}
