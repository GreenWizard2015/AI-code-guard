import type { ProcessSignalContract } from "src/protocols";

/** Responsibilities: _process liveness fixture_, _termination observations_. **/
export class ReviewRunLockProcessSignalFixture implements ProcessSignalContract {
	private readonly live_processes: ReadonlySet<number>;
	private readonly live_groups: ReadonlySet<number>;
	public readonly terminated_signals: string[];

	/** Responsibilities: _process signal fixture initialization_. **/
	public constructor(live_processes: ReadonlySet<number>, live_groups: ReadonlySet<number>) {
		this.live_processes = live_processes;
		this.live_groups = live_groups;
		this.terminated_signals = [];
	}

	/** Responsibilities: _process liveness result_. **/
	public pid_exists(pid: number): boolean {
		return this.live_processes.has(pid);
	}

	/** Responsibilities: _process-group liveness result_. **/
	public group_exists(pid: number): boolean {
		return this.live_groups.has(pid);
	}

	/** Responsibilities: _termination signal recording_. **/
	public terminate_group(pid: number): void {
		this.terminated_signals.push(`${pid}:SIGTERM`, `${pid}:SIGKILL`);
	}
}
