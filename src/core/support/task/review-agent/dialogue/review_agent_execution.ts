import { HOOK_AGENT_OUTPUT, HOOK_AGENT_START } from "src/core/support/task/review-agent/constants";
import type {
	ReviewAgentCatalogContract,
	ReviewAgentDebugLogContract,
	ReviewAgentExecutionContract,
	ReviewAgentHooksContract,
} from "src/core/support/task/review-agent/protocols";
import type { ReviewAgentExecutionOptions } from "src/core/support/task/review-agent/types";
import type {
	ReviewAgentDialogueExecution,
	ReviewAgentExecutionResult,
	ReviewAgentHookEvent,
	ReviewAgentHookEventName,
	ReviewAgentName,
	ReviewAgentProcessResult,
} from "src/task_review_types";

/** Responsibilities: _review-agent lifecycle events_, _review-agent process execution_. **/
export class ReviewAgentExecution implements ReviewAgentExecutionContract {
	private readonly _root: string;
	private readonly _review_root: string;
	private readonly _hook_file: string;
	private readonly _debug_log: ReviewAgentDebugLogContract;
	private readonly _agent_catalog: ReviewAgentCatalogContract;
	private readonly _hooks: ReviewAgentHooksContract;
	private readonly _review_stage: string;
	private readonly _review_prefix: string;
	private readonly _review_start_ms: number;
	private readonly _selection: ReviewAgentName;

	/** Responsibilities: _review-hook denial result_. **/
	private denied_execution(reason: string, process: ReviewAgentProcessResult): ReviewAgentExecutionResult {
		const message = `Error: ${reason}`;
		return {
			provider: "none",
			process: { exit_code: 1, stdout: process.stdout, stderr: reason },
			no_issues: false,
			message,
		};
	}

	/** Responsibilities: _review-agent lifecycle event construction_. **/
	private event(name: ReviewAgentHookEventName, process: ReviewAgentProcessResult): ReviewAgentHookEvent {
		return {
			context: {
				event: name,
				provider: this._selection,
				root: this._root,
				review_root: this._review_root,
				hook_file: this._hook_file,
				review_stage: this._review_stage,
				review_prefix: this._review_prefix,
				review_start_ms: this._review_start_ms,
			},
			tool: { name: "", input: "" },
			result: process,
		};
	}

	/** Responsibilities: _review-agent execution initialization_. **/
	public constructor(options: ReviewAgentExecutionOptions) {
		this._selection = options.selection;
		this._root = options.root;
		this._review_root = options.review_root;
		this._hook_file = options.hook_file;
		this._review_stage = options.review_stage;
		this._review_prefix = options.review_prefix;
		this._review_start_ms = options.review_start_ms;
		this._debug_log = options.debug_log;
		this._agent_catalog = options.agent_catalog;
		this._hooks = options.hooks;
	}

	/** Responsibilities: _asynchronous review-agent dialogue_. **/
	public async run_dialogue_async(execution: ReviewAgentDialogueExecution): Promise<ReviewAgentExecutionResult> {
		const empty_process = { exit_code: 0, stdout: "", stderr: "" };
		const start_decision = this._hooks.run(this.event(HOOK_AGENT_START, empty_process));
		if (!start_decision.allowed) {
			return this.denied_execution(start_decision.reason, empty_process);
		}
		const result = await this._agent_catalog.run_async(this._selection, { run_request: execution.request });
		this._debug_log.append(execution.dialogue, execution.request, result);
		const output_decision = this._hooks.run(this.event(HOOK_AGENT_OUTPUT, result.process));
		if (!output_decision.allowed) {
			return this.denied_execution(output_decision.reason, result.process);
		}
		return result;
	}

	/** Responsibilities: _system failure result construction_. **/
	public system_failure(message: string): ReviewAgentExecutionResult {
		return {
			provider: "none",
			process: { exit_code: 1, stdout: "", stderr: message },
			no_issues: false,
			message,
		};
	}
}
