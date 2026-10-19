import type { ChildProcess } from "node:child_process";
import { ReviewAgentProcess } from "src/core/support/task/review_agent_process";

/** Responsibilities: _cleanup failure simulation_, _review child injection_. **/
export class CleanupFailureReviewAgentProcess extends ReviewAgentProcess {
	private readonly child: ChildProcess;

	/** Responsibilities: _fake child creation_. **/
	protected override create_agent(_command: string, _arguments_list: readonly string[], _root: string): ChildProcess {
		return this.child;
	}

	/** Responsibilities: _cleanup failure simulation_. **/
	protected override unregister_agent(_root: string, _child: ChildProcess): string {
		return "simulated registry cleanup failure";
	}

	/** Responsibilities: _review child injection_. **/
	public constructor(child: ChildProcess) {
		super();
		this.child = child;
	}
}
