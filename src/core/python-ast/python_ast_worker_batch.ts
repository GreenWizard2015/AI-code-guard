import type { PythonAstWorkerResponse } from "src/core/python-ast/types";
import type {
	PythonAstWorkerBatchContract,
	PythonAstWorkerBatchOperationsContract,
	PythonAstWorkerBatchOwnerContract,
} from "src/python_protocols";

/** Responsibilities: _Python batch identity_, _worker batch lifecycle_. **/
export class PythonAstWorkerBatch implements PythonAstWorkerBatchContract {
	private readonly _batch_id: string;
	private readonly _sources: Map<string, string>;
	private readonly _operations: PythonAstWorkerBatchOperationsContract;
	private readonly _owner: PythonAstWorkerBatchOwnerContract;

	/** Responsibilities: _batch capability initialization_. **/
	public constructor(
		batch_id: string,
		sources: Map<string, string>,
		operations: PythonAstWorkerBatchOperationsContract,
		owner: PythonAstWorkerBatchOwnerContract,
	) {
		this._batch_id = batch_id;
		this._sources = sources;
		this._operations = operations;
		this._owner = owner;
	}

	/** Responsibilities: _batch source result_. **/
	public result(): PythonAstWorkerResponse {
		this._owner.assert_active();
		return this._operations.batch_result(this._batch_id, this._sources);
	}

	/** Responsibilities: _batch source submission_. **/
	public start(): void {
		this._owner.assert_active();
		this._operations.start_batch(this._batch_id, this._sources);
		this._owner.batch_started(this);
	}

	/** Responsibilities: _batch response collection_. **/
	public complete(): PythonAstWorkerResponse {
		try {
			this._owner.assert_active();
			return this._operations.complete_batch(this._batch_id);
		} finally {
			this._owner.batch_finished(this);
		}
	}

	/** Responsibilities: _batch cancellation_. **/
	public cancel(): void {
		try {
			this._owner.assert_active();
			this._operations.cancel_batch(this._batch_id);
		} finally {
			this._owner.batch_finished(this);
		}
	}
}
