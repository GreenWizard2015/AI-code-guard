import type {
	ReviewAgentCatalogContract,
	ReviewAgentDebugLogContract,
	ReviewAgentExecutionContract,
	ReviewAgentHooksContract,
} from "src/core/support/task/review-agent/protocols";
import type {
	ReviewAgentExecutionResult,
	ReviewAgentHookEventContract,
	ReviewAgentHookEventName,
	ReviewAgentPhase,
	ReviewAgentProcessResult,
	ReviewAgentRequest,
	ReviewAgentSelection,
} from "src/types";
import type { ReviewAgentExecutionOptions } from "src/core/support/task/review-agent/types";
import { HOOK_AGENT_OUTPUT, HOOK_AGENT_START } from "src/core/support/task/review-agent/constants";

/** Responsibilities: _review-agent lifecycle events_, _review-agent process execution_. **/
export class ReviewAgentExecution implements ReviewAgentExecutionContract {
	private readonly root: string;
	private readonly review_root: string;
	private readonly hook_file: string;
	private readonly debug_log: ReviewAgentDebugLogContract;
	private readonly agent_catalog: ReviewAgentCatalogContract;
	private readonly hooks: ReviewAgentHooksContract;
	private readonly review_stage: string;
	private readonly review_prefix: string;

	/** Responsibilities: _review-agent lifecycle event construction_. **/
	private event(
		name: ReviewAgentHookEventName,
		selection: ReviewAgentSelection,
		process: ReviewAgentProcessResult,
		phase: ReviewAgentPhase,
	): ReviewAgentHookEventContract {
		return {
			event: name,
			provider: selection,
			root: this.root,
			review_root: this.review_root,
			hook_file: this.hook_file,
			tool_name: "",
			tool_input: "",
			exit_code: process.exit_code,
			stdout: process.stdout,
			stderr: process.stderr,
			review_stage: this.review_stage,
			review_prefix: this.review_prefix,
			review_phase: phase,
		};
	}

	/** Responsibilities: _asynchronous review-agent dialogue_. **/
	private async execute_dialogue_async(
		selection: ReviewAgentSelection,
		request: ReviewAgentRequest,
		dialogue: string,
		phase: ReviewAgentPhase,
	): Promise<ReviewAgentExecutionResult> {
		const empty_process = { exit_code: 0, stdout: "", stderr: "" };
		this.hooks.run(this.event(HOOK_AGENT_START, selection, empty_process, phase));
		const execution = await this.agent_catalog.run_async(selection, { run_request: request });
		this.debug_log.append(dialogue, request, execution);
		this.hooks.run(this.event(HOOK_AGENT_OUTPUT, selection, execution.process, phase));
		return execution;
	}

	/** Responsibilities: _review-agent execution initialization_. **/
	public constructor(options: ReviewAgentExecutionOptions) {
		this.root = options.root;
		this.review_root = options.review_root;
		this.hook_file = options.hook_file;
		this.review_stage = options.review_stage;
		this.review_prefix = options.review_prefix;
		this.debug_log = options.debug_log;
		this.agent_catalog = options.agent_catalog;
		this.hooks = options.hooks;
	}

	/** Responsibilities: _initial review-agent dialogue_. **/
	public initial_dialogue_async(
		selection: ReviewAgentSelection,
		request: ReviewAgentRequest,
		dialogue: string,
	): Promise<ReviewAgentExecutionResult> {
		return this.execute_dialogue_async(selection, request, dialogue, "initial");
	}

	/** Responsibilities: _cleanup review-agent dialogue_. **/
	public cleanup_async(
		selection: ReviewAgentSelection,
		request: ReviewAgentRequest,
	): Promise<ReviewAgentExecutionResult> {
		return this.execute_dialogue_async(selection, request, "cleanup", "cleanup");
	}
}
