import type { ChildProcess } from "node:child_process";
import { ReviewAgentProcess } from "src/core/support/task/review_agent_process";

/** Responsibilities: _streaming provider simulation_, _review termination handling_. **/
export class StreamingReviewAgentProcess extends ReviewAgentProcess {
	private readonly child: ChildProcess;

	/** Responsibilities: _fake child creation_. **/
	protected override create_agent(_command: string, _arguments_list: readonly string[], _root: string): ChildProcess {
		return this.child;
	}

	/** Responsibilities: _termination observation_. **/
	protected override terminate_agent(_child: ChildProcess, _signal: NodeJS.Signals): void {}

	/** Responsibilities: _review child injection_. **/
	public constructor(child: ChildProcess) {
		super();
		this.child = child;
	}
}
