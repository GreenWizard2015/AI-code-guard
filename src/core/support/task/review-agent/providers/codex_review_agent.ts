import { REVIEW_ADD_DIRECTORY_ARGUMENT } from "src/core/support/task/review-agent/constants";
import type {
	ReviewAgentContract,
	ReviewAgentProcessContract,
	ReviewAgentProcessRequest,
} from "src/core/support/task/review-agent/protocols";
import { ReviewAgentHookCommand } from "src/core/support/task/review-agent/review_agent_hook_command";
import type { CodexReviewAgentName, ReviewAgentProcessResult, ReviewAgentRequest } from "src/task_review_types";

/** Responsibilities: _Codex review invocation_, _Codex hook settings assembly_. **/
export class CodexReviewAgent implements ReviewAgentContract {
	private readonly _process: ReviewAgentProcessContract;
	private readonly _agent_name: CodexReviewAgentName;

	/** Responsibilities: _Codex hook configuration_. **/
	private hooks_config(request: ReviewAgentRequest): string {
		const hook_command = new ReviewAgentHookCommand(
			request.hook.hook_command,
			request.hook.hook_file,
			request.hook.review_prefix,
			request.hook.review_start_ms,
		);
		const handler = `{type="command",command=${JSON.stringify(hook_command.command())}}`;
		return `hooks={SessionStart=[{hooks=[${handler}]}],PreToolUse=[{matcher=".*",hooks=[${handler}]}],PostToolUse=[{matcher=".*",hooks=[${handler}]}],Stop=[{hooks=[${handler}]}]}`;
	}

	/** Responsibilities: _Codex process dependency initialization_. **/
	public constructor(process: ReviewAgentProcessContract, agent_name: CodexReviewAgentName = "codex") {
		this._process = process;
		this._agent_name = agent_name;
	}

	/** Responsibilities: _Codex provider identity_. **/
	public agent_name(): CodexReviewAgentName {
		switch (this._agent_name) {
			case "codex":
				return "codex";
			case "cx":
				return "cx";
			case "cxa":
				return "cxa";
			default:
				throw new Error(`Unsupported Codex review agent: ${String(this._agent_name)}`);
		}
	}

	/** Responsibilities: _Codex CLI availability_. **/
	public available(): boolean {
		return this._process.available(this.agent_name());
	}

	/** Responsibilities: _parallel Codex architecture-review execution_. **/
	public run_async(request: ReviewAgentRequest): Promise<ReviewAgentProcessResult> {
		const process_request: ReviewAgentProcessRequest = {
			command: this.agent_name(),
			arguments_list: [
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
			root: request.root,
		};
		return this._process.run_async(process_request);
	}
}
