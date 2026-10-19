import type { ReviewAgentSelection } from "src/types";
import type { SpawnSyncOptions, SpawnSyncReturns } from "node:child_process";

export type CommandResult = { status: number; error_message: string };
export type CommandSpawnResult = SpawnSyncReturns<Buffer>;
export type CommandSpawnContract = (
	command: string,
	args: readonly string[],
	options: SpawnSyncOptions,
) => CommandSpawnResult;

/** Responsibilities: _command execution_. **/
export interface CommandRunnerContract {
	run(command: string, args: readonly string[], env: NodeJS.ProcessEnv, cwd: string): CommandResult;
}

export type TestRunnerRequest = {
	readonly args: readonly string[];
	readonly help_requested: boolean;
	readonly headless: boolean;
	readonly skip_quality: boolean;
	readonly force_review: boolean;
	readonly review_cleanup: boolean;
	readonly review_agent: ReviewAgentSelection;
};

export type QualityCheck = {
	readonly label: string;
	readonly command: string;
	readonly args: readonly string[];
	readonly environment: NodeJS.ProcessEnv;
	readonly supports_review_options: boolean;
	readonly supports_review_agent: boolean;
};

export type QualityCheckRunOptions = {
	readonly force_review: boolean;
	readonly review_cleanup: boolean;
	readonly review_agent: ReviewAgentSelection;
};

export type QualityCheckArgument = {
	readonly enabled: boolean;
	readonly argument: string;
};

export type QualityCheckExecutionOptions = {
	readonly skip_quality: boolean;
	readonly force_review: boolean;
	readonly review_cleanup: boolean;
	readonly review_agent: ReviewAgentSelection;
};
/** Responsibilities: _process exit signaling_. **/
export interface ProcessExitContract {
	exit(status: number): void;
}
