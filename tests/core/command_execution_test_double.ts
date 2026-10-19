import type { CommandResult, CommandRunnerContract, ProcessExitContract } from "test-runner/types";

/** Responsibilities: _failed command result delivery_, _command invocation recording_, _exit status recording_. **/
export class CommandExecutionTestDouble implements CommandRunnerContract, ProcessExitContract {
	public readonly calls: string[][] = [];
	public readonly environments: NodeJS.ProcessEnv[] = [];
	public readonly working_directories: string[] = [];
	public exit_status = -1;
	private readonly statuses: readonly number[];
	private status_index = 0;

	/** Responsibilities: _command status values_. **/
	public constructor(statuses: readonly number[]) {
		this.statuses = statuses;
	}

	/** Responsibilities: _failed command recording_. **/
	public run(command: string, args: readonly string[], env: NodeJS.ProcessEnv, cwd: string): CommandResult {
		this.calls.push([command, ...args]);
		this.environments.push(env);
		this.working_directories.push(cwd);
		const configured = this.statuses[Math.min(this.status_index, this.statuses.length - 1)];
		let status = 3;
		if (configured !== undefined) {
			status = configured;
		}
		this.status_index += 1;
		return { status, error_message: "" };
	}

	/** Responsibilities: _exit status recording_. **/
	public exit(status: number): void {
		this.exit_status = status;
	}
}
