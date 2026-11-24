import type {
	ReviewAgentHookProcessRequest,
	ReviewAgentHooksContract,
	ReviewAgentProcessContract,
} from "src/core/support/task/review-agent/protocols";
import type { HookDecision } from "src/model_types";
import type { ReviewAgentHookEvent } from "src/task_review_types";

/** Responsibilities: _review-agent hook invocation_, _hook decision parsing_. **/
export class ReviewAgentHooks implements ReviewAgentHooksContract {
	private readonly _process: ReviewAgentProcessContract;
	private readonly _command: string;
	private readonly _hook_file: string;
	private readonly _root: string;

	/** Responsibilities: _hook process initialization_. **/
	public constructor(root: string, command: string, hook_file: string, process: ReviewAgentProcessContract) {
		this._root = root;
		this._command = command;
		this._hook_file = hook_file;
		this._process = process;
	}

	/** Responsibilities: _review-agent lifecycle hook_. **/
	public run(event: ReviewAgentHookEvent): HookDecision {
		const request: ReviewAgentHookProcessRequest = {
			command: this._command,
			hook_file: this._hook_file,
			event,
			root: this._root,
		};
		const result = this._process.run_hook(request);
		if (result.exit_code !== 0) {
			throw new Error(`Review hook failed: ${result.stderr}`);
		}
		if (result.stdout.trim().length === 0) {
			return { allowed: true, reason: "" };
		}
		return JSON.parse(result.stdout);
	}
}
