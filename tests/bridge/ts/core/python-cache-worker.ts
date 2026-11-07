import type { AstModel } from "src/core/ast_model";
import { PythonAstWorkerBatch } from "src/core/python-ast/python_ast_worker_batch";
import type { PythonAstWorkerResponse } from "src/core/python-ast/types";
import type { PythonAstWorkerContract } from "src/python_protocols";

/** Responsibilities: _worker responses_, _worker requests_. **/
export class PythonCacheWorker implements PythonAstWorkerContract {
	private readonly _result: ReturnType<AstModel["empty_ast_file"]>;
	private _pending_sources: Map<string, string>;
	private _closed: boolean;
	private _calls = 0;

	/** Responsibilities: _cached AST fixture initialization_. **/
	public constructor(result: ReturnType<AstModel["empty_ast_file"]>) {
		this._result = result;
		this._pending_sources = new Map<string, string>();
		this._closed = false;
	}

	/** Responsibilities: _worker batch identity_. **/
	public batch(batch_id: string, sources: Map<string, string>): PythonAstWorkerBatch {
		return new PythonAstWorkerBatch(batch_id, sources, () => this);
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
	public start_batch(_batch_id: string, sources: Map<string, string>): void {
		this._pending_sources = sources;
	}

	/** Responsibilities: _staged batch delivery_. **/
	public complete_batch(batch_id: string): PythonAstWorkerResponse {
		return this.batch_result(batch_id, this._pending_sources);
	}

	/** Responsibilities: _abandoned batch response consumption_. **/
	public cancel_batch(batch_id: string): void {
		this.complete_batch(batch_id);
		this._pending_sources = new Map<string, string>();
	}

	/** Responsibilities: _worker fixture shutdown_. **/
	public close(): void {
		this._closed = true;
	}

	/** Responsibilities: _worker process completion_. **/
	public wait_for_exit(): Promise<void> {
		return Promise.resolve();
	}

	/** Responsibilities: _worker process state_. **/
	public has_exited(): boolean {
		return this._closed;
	}

	/** Responsibilities: _worker request count observation_. **/
	public call_count(): number {
		return this._calls;
	}
}
