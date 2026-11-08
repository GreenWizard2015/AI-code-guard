import { REVIEW_ADD_DIRECTORY_ARGUMENT } from "src/core/support/task/review-agent/constants";
import type {
	ReviewAgentContract,
	ReviewAgentProcessContract,
	ReviewAgentProcessRequest,
} from "src/core/support/task/review-agent/protocols";
import { ReviewAgentHookCommand } from "src/core/support/task/review-agent/review_agent_hook_command";
import type { ReviewAgentProcessResult, ReviewAgentRequest } from "src/task_review_types";

/** Responsibilities: _Claude review invocation_, _Claude hook settings assembly_. **/
export class ClaudeReviewAgent implements ReviewAgentContract {
	private readonly _process: ReviewAgentProcessContract;

	/** Responsibilities: _Claude hook configuration_. **/
	private hook_settings(request: ReviewAgentRequest): string {
		const hook_command = new ReviewAgentHookCommand(
			request.hook.hook_command,
			request.hook.hook_file,
			request.hook.review_prefix,
			request.hook.review_start_ms,
		);
		const handler = {
			type: "command",
			command: hook_command.command(),
		};
		return JSON.stringify({
			hooks: {
				SessionStart: [{ hooks: [handler] }],
				PreToolUse: [{ matcher: ".*", hooks: [handler] }],
				PostToolUse: [{ matcher: ".*", hooks: [handler] }],
				Stop: [{ hooks: [handler] }],
			},
		});
	}

	/** Responsibilities: _Claude process dependency initialization_. **/
	public constructor(process: ReviewAgentProcessContract) {
		this._process = process;
	}

	/** Responsibilities: _Claude provider identity_. **/
	public agent_name(): "claude" {
		return "claude";
	}

	/** Responsibilities: _Claude CLI availability_. **/
	public available(): boolean {
		return this._process.available(this.agent_name());
	}

	/** Responsibilities: _parallel Claude architecture-review execution_. **/
	public run_async(request: ReviewAgentRequest): Promise<ReviewAgentProcessResult> {
		const process_request: ReviewAgentProcessRequest = {
			command: this.agent_name(),
			arguments_list: [
				"--print",
				"--output-format",
				"json",
				REVIEW_ADD_DIRECTORY_ARGUMENT,
				request.review_root,
				"--allowed-tools",
				"Read,Write,Bash",
				"--disallowed-tools",
				"Edit,NotebookEdit",
				"--settings",
				this.hook_settings(request),
				request.prompt,
			],
			root: request.root,
		};
		return this._process.run_async(process_request);
	}
}
