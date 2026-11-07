import { LintStageTimer } from "src/lint_stage_timer";
import type { CallableAsyncOperation } from "src/runtime_types";

/** Responsibilities: _review failure injection_, _timing delegation_. **/
export class ArchitectureReviewFailureTimer extends LintStageTimer {
	private readonly _failure_message: string;

	/** Responsibilities: _failure message storage_. **/
	public constructor(failure_message: string) {
		super();
		this._failure_message = failure_message;
	}

	/** Responsibilities: _stage failure selection_. **/
	public override measure_async<T>(stage_name: string, operation: CallableAsyncOperation<T>): Promise<T> {
		if (stage_name === "architecture-review") {
			return Promise.reject(new Error(this._failure_message));
		}
		return super.measure_async(stage_name, operation);
	}
}
