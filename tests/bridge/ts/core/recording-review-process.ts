import type { ReviewAgentProcessContract } from "src/core/support/task/review-agent/protocols";
import type { ReviewAgentHookEventContract, ReviewAgentProcessResult } from "src/types";

/** Responsibilities: _review-agent command recording_, _process fixture output_. **/
export class RecordingProcess implements ReviewAgentProcessContract {
	public command = "";
	public arguments_list: readonly string[] = [];
	public root = "";
	public hook_command = "";
	public hook_file = "";
	public hook_event: ReviewAgentHookEventContract = {
		event: "",
		provider: "none",
		root: "",
		review_root: "",
		hook_file: "",
		review_stage: "",
		review_prefix: "",
		review_phase: "initial",
		tool_name: "",
		tool_input: "",
		exit_code: 0,
		stdout: "",
		stderr: "",
	};
	public hook_root = "";
	public hook_result: ReviewAgentProcessResult = {
		exit_code: 0,
		stdout: JSON.stringify({ allowed: true, reason: "" }),
		stderr: "",
	};

	/** Responsibilities: _recording command availability_. **/
	public available(_command: string): boolean {
		return true;
	}

	/** Responsibilities: _recording command execution_. **/
	public run(command: string, arguments_list: readonly string[], root: string): ReviewAgentProcessResult {
		this.command = command;
		this.arguments_list = arguments_list;
		this.root = root;
		return { exit_code: 0, stdout: "", stderr: "" };
	}

	/** Responsibilities: _recording parallel command execution_. **/
	public run_async(
		command: string,
		arguments_list: readonly string[],
		root: string,
	): Promise<ReviewAgentProcessResult> {
		return Promise.resolve(this.run(command, arguments_list, root));
	}

	/** Responsibilities: _recording hook execution_. **/
	public run_hook(
		command: string,
		hook_file: string,
		event: ReviewAgentHookEventContract,
		root: string,
	): ReviewAgentProcessResult {
		this.hook_command = command;
		this.hook_file = hook_file;
		this.hook_event = event;
		this.hook_root = root;
		return this.hook_result;
	}
}
