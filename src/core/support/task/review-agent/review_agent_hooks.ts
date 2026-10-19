import type {
	ReviewAgentHooksContract,
	ReviewAgentProcessContract,
} from "src/core/support/task/review-agent/protocols";
import type { ReviewAgentHookEventContract, ReviewAgentProcessResult } from "src/types";
import type { HookDecision } from "src/model/types/types";

/** Responsibilities: _review-agent hook invocation_, _hook decision parsing_. **/
export class ReviewAgentHooks implements ReviewAgentHooksContract {
	private readonly process: ReviewAgentProcessContract;
	private readonly command: string;
	private readonly hook_file: string;
	private readonly root: string;

	/** Responsibilities: _hook result parsing_. **/
	private decision(result: ReviewAgentProcessResult): HookDecision {
		if (result.exit_code !== 0) {
			throw new Error(`Review hook failed: ${result.stderr}`);
		}
		if (result.stdout.trim() === "") {
			return { allowed: true, reason: "" };
		}
		return JSON.parse(result.stdout);
	}

	/** Responsibilities: _hook process initialization_. **/
	public constructor(root: string, command: string, hook_file: string, process: ReviewAgentProcessContract) {
		this.root = root;
		this.command = command;
		this.hook_file = hook_file;
		this.process = process;
	}

	/** Responsibilities: _review-agent lifecycle hook_. **/
	public run(event: ReviewAgentHookEventContract): HookDecision {
		const result = this.process.run_hook(this.command, this.hook_file, event, this.root);
		const decision = this.decision(result);
		if (!decision.allowed) {
			throw new Error(decision.reason);
		}
		return decision;
	}
}
