import type {
	DocumentationExampleExecution,
	DocumentationExampleExecutorContract,
} from "documentation_validation/types";

/** Responsibilities: _example execution control_, _execution observation_. **/
export class DocumentationExampleExecutorProbe implements DocumentationExampleExecutorContract {
	private readonly _result: DocumentationExampleExecution;
	private _execution_count: number;

	/** Responsibilities: _test output configuration_. **/
	public constructor(result: DocumentationExampleExecution) {
		this._result = result;
		this._execution_count = 0;
	}

	/** Responsibilities: _example output delivery_. **/
	public capture_output(): DocumentationExampleExecution {
		this._execution_count += 1;
		return this._result;
	}

	/** Responsibilities: _execution count access_. **/
	public calls(): number {
		return this._execution_count;
	}
}
