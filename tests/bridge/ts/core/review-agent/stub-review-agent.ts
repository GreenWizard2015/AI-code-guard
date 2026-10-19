import type { ReviewAgentContract } from "src/core/support/task/review-agent/protocols";
import type { ReviewAgentProcessResult, ReviewAgentRequest } from "src/types";

/** Responsibilities: _review-agent availability fixture_, _review-agent output fixture_. **/
export class StubReviewAgent implements ReviewAgentContract {
	private readonly provider_name: "codex" | "claude";
	public readonly available_result: boolean;
	public readonly exit_code: number;
	public readonly output: string;
	public request_was_received = false;

	/** Responsibilities: _stub review-agent initialization_. **/
	public constructor(name: "codex" | "claude", available_result: boolean, exit_code: number, output: string) {
		this.provider_name = name;
		this.available_result = available_result;
		this.exit_code = exit_code;
		this.output = output;
	}

	/** Responsibilities: _stub provider identity_. **/
	public agent_name(): "codex" | "claude" {
		return this.provider_name;
	}

	/** Responsibilities: _stub review-agent availability_. **/
	public available(): boolean {
		return this.available_result;
	}

	/** Responsibilities: _stub review-agent execution_. **/
	public run(_request: ReviewAgentRequest): ReviewAgentProcessResult {
		this.request_was_received = true;
		return { exit_code: this.exit_code, stdout: this.output, stderr: "" };
	}

	/** Responsibilities: _stub parallel review-agent execution_. **/
	public run_async(request: ReviewAgentRequest): Promise<ReviewAgentProcessResult> {
		return Promise.resolve(this.run(request));
	}
}
