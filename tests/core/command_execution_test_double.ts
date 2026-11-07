import type { CommandResult, CommandRunnerContract, ProcessExitContract } from "test-runner/types";

/** Responsibilities: _failed command result delivery_, _command invocation recording_, _exit status recording_. **/
export class CommandExecutionTestDouble implements CommandRunnerContract, ProcessExitContract {
	private readonly _calls: string[][];
	private readonly _environments: NodeJS.ProcessEnv[];
	private readonly _working_directories: string[];
	private _exit_status = -1;
	private readonly _statuses: readonly number[];
	private _status_index = 0;

	/** Responsibilities: _command status values_. **/
	public constructor(statuses: readonly number[]) {
		this._statuses = statuses;
		this._calls = [];
		this._environments = [];
		this._working_directories = [];
	}

	/** Responsibilities: _failed command recording_. **/
	public run(command: string, args: readonly string[], env: NodeJS.ProcessEnv, cwd: string): CommandResult {
		this._calls.push([command, ...args]);
		this._environments.push(env);
		this._working_directories.push(cwd);
		const configured = this._statuses[Math.min(this._status_index, this._statuses.length - 1)];
		let status = 3;
		if (configured !== undefined) {
			status = configured;
		}
		this._status_index += 1;
		return { status, error_message: "" };
	}

	/** Responsibilities: _exit status recording_. **/
	public exit(status: number): void {
		this._exit_status = status;
	}

	/** Responsibilities: _recorded command observations_. **/
	public snapshot(): {
		calls: readonly (readonly string[])[];
		environments: readonly NodeJS.ProcessEnv[];
		working_directories: readonly string[];
		exit_status: number;
	} {
		return {
			calls: this._calls.map((call) => [...call]),
			environments: this._environments.map((environment) => ({ ...environment })),
			working_directories: [...this._working_directories],
			exit_status: this._exit_status,
		};
	}
}
