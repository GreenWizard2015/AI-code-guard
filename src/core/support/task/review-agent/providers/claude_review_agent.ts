import type {
	ReviewAgentProcessContract,
	ReviewAgentContract,
} from "src/core/support/task/review-agent/protocols";
import type { ReviewAgentProcessResult, ReviewAgentRequest } from "src/types";
import { REVIEW_ADD_DIRECTORY_ARGUMENT } from "src/core/support/task/review-agent/constants";
import { ReviewAgentHookCommand } from "src/core/support/task/review-agent/review_agent_hook_command";

/** Responsibilities: _Claude review invocation_, _Claude hook settings assembly_. **/
export class ClaudeReviewAgent implements ReviewAgentContract {
	private readonly process: ReviewAgentProcessContract;

	/** Responsibilities: _Claude hook configuration_. **/
	private hook_settings(request: ReviewAgentRequest): string {
		const hook_command = new ReviewAgentHookCommand(
			request.hook.hook_command,
			request.hook.hook_file,
			request.hook.review_prefix,
			request.hook.review_phase,
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
		this.process = process;
	}

	/** Responsibilities: _Claude provider identity_. **/
	public agent_name(): "claude" {
		return "claude";
	}

	/** Responsibilities: _Claude CLI availability_. **/
	public available(): boolean {
		return this.process.available(this.agent_name());
	}

	/** Responsibilities: _parallel Claude architecture-review execution_. **/
	public run_async(request: ReviewAgentRequest): Promise<ReviewAgentProcessResult> {
		return this.process.run_async(
			this.agent_name(),
			[
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
			request.root,
		);
	}
}
