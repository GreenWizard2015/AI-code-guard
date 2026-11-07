import { BoundaryFailureCategory } from "src/analysis_protocols";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { HOOK_AGENT_STOP } from "src/core/support/task/review-agent/constants";
import type {
	ReviewAgentDialogueContract,
	ReviewAgentFilesContract,
	ReviewAgentHooksContract,
	ReviewAgentStageCollaborators,
	ReviewAgentStageRequestContext,
	TaskReviewAgentStageExecutionContract,
	TaskReviewAgentStageExecutionOptions,
} from "src/core/support/task/review-agent/protocols";
import type {
	ReviewAgentExecutionResult,
	ReviewAgentHookEvent,
	ReviewAgentPhase,
	ReviewAgentProcessResult,
	ReviewAgentRequest,
	ReviewAgentSelection,
	ReviewStageDefinition,
	TaskReviewRunResult,
} from "src/task_review_types";

/** Responsibilities: _parallel review stage lifecycle_, _stage-scoped prompt state_. **/
export class TaskReviewAgentStageExecution implements TaskReviewAgentStageExecutionContract {
	private readonly _root: string;
	private readonly _review_root: string;
	private readonly _instruction: string;
	private readonly _hook_file: string;
	private readonly _hook_command: string;
	private readonly _stage: ReviewStageDefinition;
	private readonly _review_start_ms: number;
	private readonly _review_cleanup: boolean;
	private readonly _boundary_failures: SystemFailureClassificationContract;
	private readonly _review_documents: ReviewAgentFilesContract;
	private readonly _stage_documents: ReviewAgentFilesContract;
	private readonly _hooks: ReviewAgentHooksContract;
	private readonly _dialogue: ReviewAgentDialogueContract;

	/** Responsibilities: _review lifecycle event construction_. **/
	private event(provider: ReviewAgentSelection, process: ReviewAgentProcessResult): ReviewAgentHookEvent {
		return {
			context: {
				event: HOOK_AGENT_STOP,
				provider,
				root: this._root,
				review_root: this._review_root,
				hook_file: this._hook_file,
				review_stage: this._stage.id,
				review_prefix: this._stage.prefix,
				review_phase: "cleanup",
				review_start_ms: this._review_start_ms,
			},
			tool: { name: "", input: "" },
			result: process,
		};
	}

	/** Responsibilities: _stop-hook decision handling_. **/
	private stop_agent(result: ReviewAgentExecutionResult): TaskReviewRunResult {
		try {
			const decision = this._hooks.run(this.event(result.provider, result.process));
			if (!decision.allowed) {
				this._review_documents.write_failure(decision.reason);
				return { provider: "none", message: decision.reason };
			}
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
			const message = String(error);
			this._review_documents.write_failure(message);
			return { provider: "none", message };
		}
		return { provider: result.provider, message: result.message };
	}

	/** Responsibilities: _review cleanup dialogue_. **/
	private async cleanup(): Promise<TaskReviewRunResult> {
		const result = await this._dialogue.cleanup_dialogue_async(
			this.request(this._stage_documents.current_review_notes(), "cleanup", ""),
		);
		if (result.process.exit_code !== 0) {
			this._review_documents.write_failure(result.message);
			return { provider: "none", message: result.message };
		}
		return this.stop_agent(result);
	}

	/** Responsibilities: _review execution result finalization_. **/
	private async finish(execution: ReviewAgentExecutionResult): Promise<TaskReviewRunResult> {
		if (execution.provider === "none") {
			this._review_documents.write_failure(execution.message);
			return { provider: "none", message: execution.message };
		}
		if (execution.no_issues) {
			return this.stop_agent(execution);
		}
		if (this._stage_documents.current_review_notes().length === 0) {
			return this.stop_agent(execution);
		}
		if (!this._review_cleanup) {
			return this.stop_agent(execution);
		}
		return await this.cleanup();
	}

	/** Responsibilities: _stage review failure handling_. **/
	private stage_failure(message: string): TaskReviewRunResult {
		try {
			this._review_documents.write_failure(message);
		} catch (write_error) {
			if (!this._boundary_failures.check(String(write_error), BoundaryFailureCategory.System)) {
				throw write_error;
			}
			return { provider: "none", message: `${message}; ${String(write_error)}` };
		}
		return { provider: "none", message };
	}

	/** Responsibilities: _review stage initialization_. **/
	public constructor(options: TaskReviewAgentStageExecutionOptions) {
		const context: ReviewAgentStageRequestContext = options.request_context;
		const collaborators: ReviewAgentStageCollaborators = options.collaborators;
		this._root = context.root;
		this._review_root = context.review_root;
		this._instruction = context.instruction;
		this._hook_file = context.hook_file;
		this._hook_command = context.hook_command;
		this._stage = context.stage;
		this._review_start_ms = context.review_start_ms;
		this._review_cleanup = options.review_cleanup;
		this._boundary_failures = collaborators.boundary_failures;
		this._review_documents = collaborators.review_documents;
		this._stage_documents = collaborators.stage_documents;
		this._hooks = collaborators.hooks;
		this._dialogue = collaborators.dialogue;
	}

	/** Responsibilities: _stage agent request construction_. **/
	public request(
		open_review_files: readonly string[],
		review_phase: ReviewAgentPhase,
		prompt: string,
	): ReviewAgentRequest {
		return {
			root: this._root,
			instruction: this._instruction,
			review_root: this._review_root,
			hook: {
				hook_file: this._hook_file,
				hook_command: this._hook_command,
				review_prefix: this._stage.prefix,
				review_phase,
				review_start_ms: this._review_start_ms,
			},
			review_stage: this._stage.id,
			review_stage_plan: `${this._stage.id}: ${this._stage.prefix} ${this._stage.focus}`,
			open_review_files,
			prompt,
		};
	}

	/** Responsibilities: _parallel stage execution_. **/
	public async run(): Promise<TaskReviewRunResult> {
		try {
			const execution = await this._dialogue.initial_async();
			if (execution.provider === "none") {
				this._review_documents.write_failure(execution.message);
				return { provider: "none", message: execution.message };
			}
			if (execution.process.exit_code !== 0) {
				this._review_documents.write_failure(execution.message);
				return { provider: "none", message: execution.message };
			}
			return await this.finish(execution);
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
			return this.stage_failure(String(error));
		}
	}
}
