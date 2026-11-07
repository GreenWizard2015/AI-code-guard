import type {
	OwnedProcessGroup,
	ProcessGroupReference,
	ProcessId,
	ProcessSignalContract,
} from "src/analysis_protocols";

/** Responsibilities: _process liveness fixture_, _termination observations_. **/
export class ReviewRunLockProcessSignalFixture implements ProcessSignalContract {
	private readonly _live_processes: ReadonlySet<number>;
	private readonly _live_process_groups: ReadonlySet<number>;
	private readonly _termination_succeeds: boolean;
	private readonly _owned_process_groups: ReadonlySet<string>;
	private readonly _terminated_signals: string[];

	/** Responsibilities: _process signal fixture initialization_. **/
	public constructor(
		live_processes: ReadonlySet<number>,
		live_process_groups: ReadonlySet<number>,
		termination_succeeds: boolean,
		owned_process_groups: ReadonlySet<string>,
	) {
		this._live_processes = live_processes;
		this._live_process_groups = live_process_groups;
		this._termination_succeeds = termination_succeeds;
		this._owned_process_groups = owned_process_groups;
		this._terminated_signals = [];
	}

	/** Responsibilities: _process liveness result_. **/
	public pid_exists(process_id: ProcessId): boolean {
		return this._live_processes.has(process_id.value);
	}

	/** Responsibilities: _process group liveness result_. **/
	public group_exists(group: ProcessGroupReference): boolean {
		return this._live_process_groups.has(group.id);
	}

	/** Responsibilities: _review process-group ownership probe_. **/
	public group_contains_token(owner: OwnedProcessGroup): boolean {
		return this._owned_process_groups.has(`${owner.id}:${owner.token}`);
	}

	/** Responsibilities: _owned process-group termination_. **/
	public terminate_owned_group(ownership: OwnedProcessGroup): boolean {
		if (!this.group_contains_token(ownership)) {
			return false;
		}
		return this.terminate_group({ id: ownership.id });
	}

	/** Responsibilities: _termination signal recording_. **/
	public terminate_group(target: ProcessGroupReference): boolean {
		this._terminated_signals.push(`${target.id}:SIGTERM`, `${target.id}:SIGKILL`);
		return this._termination_succeeds;
	}

	/** Responsibilities: _termination signal observation_. **/
	public termination_signals(): readonly string[] {
		return [...this._terminated_signals];
	}
}
