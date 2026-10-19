/** Responsibilities: _rollback failure aggregation_, _rollback failure reporting_. **/
export class TaskPublicationRollbackError extends AggregateError {
	/** Responsibilities: _rollback failure initialization_. **/
	public constructor(message: string) {
		super([new Error(message)], "Task publication rollback failed.");
	}
}
