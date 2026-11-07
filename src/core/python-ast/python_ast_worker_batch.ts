import type { PythonAstWorkerResponse } from "src/core/python-ast/types";
import type { CallablePythonAstWorkerBatchOperations, PythonAstWorkerBatchContract } from "src/python_protocols";

/** Responsibilities: _Python batch identity_, _worker batch lifecycle_. **/
export class PythonAstWorkerBatch implements PythonAstWorkerBatchContract {
	private readonly _batch_id: string;
	private readonly _sources: Map<string, string>;
	private readonly _worker: CallablePythonAstWorkerBatchOperations;

	/** Responsibilities: _batch capability initialization_. **/
	public constructor(batch_id: string, sources: Map<string, string>, worker: CallablePythonAstWorkerBatchOperations) {
		this._batch_id = batch_id;
		this._sources = sources;
		this._worker = worker;
	}

	/** Responsibilities: _batch source result_. **/
	public result(): PythonAstWorkerResponse {
		return this._worker().batch_result(this._batch_id, this._sources);
	}

	/** Responsibilities: _batch source submission_. **/
	public start(): void {
		this._worker().start_batch(this._batch_id, this._sources);
	}

	/** Responsibilities: _batch response collection_. **/
	public complete(): PythonAstWorkerResponse {
		return this._worker().complete_batch(this._batch_id);
	}

	/** Responsibilities: _batch cancellation_. **/
	public cancel(): void {
		this._worker().cancel_batch(this._batch_id);
	}
}
