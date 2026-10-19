import type {
	ReviewAgentProcessContract,
	ReviewAgentContract,
} from "src/core/support/task/review-agent/protocols";
import type { ReviewAgentProcessResult, ReviewAgentRequest } from "src/types";
import { REVIEW_ADD_DIRECTORY_ARGUMENT } from "src/core/support/task/review-agent/constants";
import { ReviewAgentHookCommand } from "src/core/support/task/review-agent/review_agent_hook_command";

/** Responsibilities: _Codex review invocation_, _Codex hook settings assembly_. **/
export class CodexReviewAgent implements ReviewAgentContract {
	private readonly process: ReviewAgentProcessContract;

	/** Responsibilities: _Codex hook configuration_. **/
	private hooks_config(request: ReviewAgentRequest): string {
		const hook_command = new ReviewAgentHookCommand(
			request.hook.hook_command,
			request.hook.hook_file,
			request.hook.review_prefix,
			request.hook.review_phase,
		);
		const handler = `{type="command",command=${JSON.stringify(hook_command.command())}}`;
		return `hooks={SessionStart=[{hooks=[${handler}]}],PreToolUse=[{matcher=".*",hooks=[${handler}]}],PostToolUse=[{matcher=".*",hooks=[${handler}]}],Stop=[{hooks=[${handler}]}]}`;
	}

	/** Responsibilities: _Codex process dependency initialization_. **/
	public constructor(process: ReviewAgentProcessContract) {
		this.process = process;
	}

	/** Responsibilities: _Codex provider identity_. **/
	public agent_name(): "codex" {
		return "codex";
	}

	/** Responsibilities: _Codex CLI availability_. **/
	public available(): boolean {
		return this.process.available(this.agent_name());
	}

	/** Responsibilities: _parallel Codex architecture-review execution_. **/
	public run_async(request: ReviewAgentRequest): Promise<ReviewAgentProcessResult> {
		return this.process.run_async(
			this.agent_name(),
			[
				"exec",
				"--json",
				"--ignore-user-config",
				"--cd",
				request.root,
				"--sandbox",
				"danger-full-access",
				REVIEW_ADD_DIRECTORY_ARGUMENT,
				request.review_root,
				"--skip-git-repo-check",
				"-c",
				this.hooks_config(request),
				request.prompt,
			],
			request.root,
		);
	}
}
