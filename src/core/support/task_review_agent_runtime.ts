import { join } from "node:path";
import { NODE_MODULES_DIRECTORY, REPORTING_PROJECT_ROOT } from "src/constants";
import type {
	ReviewAgentCatalogContract,
	ReviewAgentHooksContract,
} from "src/core/support/task/review-agent/protocols";
import { ClaudeReviewAgent } from "src/core/support/task/review-agent/providers/claude_review_agent";
import { CodexReviewAgent } from "src/core/support/task/review-agent/providers/codex_review_agent";
import { ReviewAgentCatalog } from "src/core/support/task/review-agent/providers/review_agent_catalog";
import { ReviewAgentHooks } from "src/core/support/task/review-agent/review_agent_hooks";
import { ReviewAgentProcess } from "src/core/support/task/review_agent_process";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _review provider runtime_, _hook process ownership_. **/
export class TaskReviewAgentRuntime {
	private readonly root: string;
	private readonly file_io: IOContract;
	private readonly process: ReviewAgentProcess;
	public readonly hook_command: string;
	public readonly hook_file: string;

	/** Responsibilities: _review runtime configuration_. **/
	public constructor(root: string, file_io: IOContract) {
		this.root = root;
		this.file_io = file_io;
		this.hook_file = join(REPORTING_PROJECT_ROOT, "src", "core", "support", "task", "agent-hooks.ts");
		this.hook_command = join(REPORTING_PROJECT_ROOT, NODE_MODULES_DIRECTORY, ".bin", "tsx");
		this.process = new ReviewAgentProcess();
	}

	/** Responsibilities: _review provider selection_. **/
	public catalog(): ReviewAgentCatalogContract {
		return new ReviewAgentCatalog(
			[new CodexReviewAgent(this.process), new ClaudeReviewAgent(this.process)],
			this.file_io,
		);
	}

	/** Responsibilities: _review hook execution_. **/
	public hooks(): ReviewAgentHooksContract {
		return new ReviewAgentHooks(this.root, this.hook_command, this.hook_file, this.process);
	}
}
