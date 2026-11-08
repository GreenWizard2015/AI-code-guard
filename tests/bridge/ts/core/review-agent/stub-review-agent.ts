import type { ReviewAgentContract } from "src/core/support/task/review-agent/protocols";
import type { ReviewAgentName, ReviewAgentProcessResult, ReviewAgentRequest } from "src/task_review_types";

/** Responsibilities: _review-agent availability fixture_, _review-agent output fixture_. **/
export class StubReviewAgent implements ReviewAgentContract {
	private readonly _provider_name: ReviewAgentName;
	private readonly _available_result: boolean;
	private readonly _exit_code: number;
	private readonly _output: string;
	private _request_was_received = false;

	/** Responsibilities: _stub review-agent initialization_. **/
	public constructor(name: ReviewAgentName, available_result: boolean, exit_code: number, output: string) {
		this._provider_name = name;
		this._available_result = available_result;
		this._exit_code = exit_code;
		this._output = output;
	}

	/** Responsibilities: _stub provider identity_. **/
	public agent_name(): ReviewAgentName {
		return this._provider_name;
	}

	/** Responsibilities: _stub review-agent availability_. **/
	public available(): boolean {
		return this._available_result;
	}

	/** Responsibilities: _stub review-agent execution_. **/
	public run(_request: ReviewAgentRequest): ReviewAgentProcessResult {
		this._request_was_received = true;
		return { exit_code: this._exit_code, stdout: this._output, stderr: "" };
	}

	/** Responsibilities: _stub parallel review-agent execution_. **/
	public run_async(request: ReviewAgentRequest): Promise<ReviewAgentProcessResult> {
		return Promise.resolve(this.run(request));
	}

	/** Responsibilities: _request receipt observation_. **/
	public request_was_received(): boolean {
		return this._request_was_received;
	}
}
