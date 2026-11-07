import type { CallableCommandSpawn, CommandResult, CommandRunnerContract, CommandSpawnResult } from "test-runner/types";

/** Responsibilities: _external command execution_, _child-process result normalization_. **/
export class CommandExecution implements CommandRunnerContract {
	private readonly _spawn: CallableCommandSpawn;

	/** Responsibilities: _exit status normalization_. **/
	private status(result: CommandSpawnResult): number {
		if (result.status === null) {
			return 1;
		}
		return result.status;
	}

	/** Responsibilities: _startup error normalization_. **/
	private error_message(result: CommandSpawnResult): string {
		if (result.error === undefined) {
			return "";
		}
		return result.error.message;
	}

	/** Responsibilities: _process dependency ownership_, _command execution setup_. **/
	public constructor(spawn: CallableCommandSpawn) {
		this._spawn = spawn;
	}

	/** Responsibilities: _synchronous child-process invocation_. **/
	public run(command: string, args: readonly string[], env: NodeJS.ProcessEnv, cwd: string): CommandResult {
		const arguments_list = [...args];
		const process_options = { env, stdio: "inherit" as const, shell: false, cwd };
		const process_result = this._spawn(command, arguments_list, process_options);
		const status = this.status(process_result);
		const error_message = this.error_message(process_result);
		return { status, error_message };
	}
}
