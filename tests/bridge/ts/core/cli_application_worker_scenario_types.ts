/** Responsibilities: _persisted CLI report text_. **/
export type RunDocuments = { readonly issues: string; readonly lint_output: string };

/** Responsibilities: _worker run observations_. **/
export type WorkerRunObservation = {
	readonly documents: RunDocuments;
	readonly lease_count: number;
	readonly registry_entry_released: boolean;
};

/** Responsibilities: _project run lifecycle_. **/
export type ProjectRunObservation = {
	readonly worker_captured: boolean;
	readonly worker_exited: boolean;
	readonly run: WorkerRunObservation;
};

/** Responsibilities: _changed-input lifecycle_. **/
export type ChangedInputObservation = {
	readonly worker_captured: boolean;
	readonly worker_exited: boolean;
	readonly first_run: WorkerRunObservation;
	readonly second_run: WorkerRunObservation;
};
