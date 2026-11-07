import type {
	ReviewAgentChildProcessContract,
	ReviewAgentProcessSignalContract,
} from "src/core/support/task/review-agent/protocols";

/** Responsibilities: _review process signal recording_, _termination request observation_. **/
export class ReviewAgentProcessSignalFixture implements ReviewAgentProcessSignalContract {
	private readonly _requests: {
		readonly target: "child" | "group";
		readonly process_id: number;
		readonly signal: NodeJS.Signals;
	}[];

	/** Responsibilities: _signal fixture initialization_. **/
	public constructor() {
		this._requests = [];
	}

	/** Responsibilities: _child signal recording_. **/
	public child_signal(child: ReviewAgentChildProcessContract, signal: NodeJS.Signals): void {
		this._requests.push({ target: "child", process_id: child.identifier(), signal });
	}

	/** Responsibilities: _process-group signal recording_. **/
	public group_signal(process_id: number, signal: NodeJS.Signals): void {
		this._requests.push({ target: "group", process_id, signal });
	}

	/** Responsibilities: _signal request snapshot_. **/
	public requests(): readonly {
		readonly target: "child" | "group";
		readonly process_id: number;
		readonly signal: NodeJS.Signals;
	}[] {
		return [...this._requests];
	}
}
