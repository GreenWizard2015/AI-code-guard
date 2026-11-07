import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import { ReviewAgentDialoguePlan } from "src/core/support/task/review-agent/dialogue/review_agent_dialogue_plan";
import { ReviewAgentExecution } from "src/core/support/task/review-agent/dialogue/review_agent_execution";
import type {
	ReviewAgentCatalogContract,
	ReviewAgentDialogueContract,
	ReviewAgentFilesContract,
} from "src/core/support/task/review-agent/protocols";
import type { ReviewAgentDialogueOptions } from "src/core/support/task/review-agent/types";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import type { ReviewAgentExecutionResult, ReviewAgentRequest } from "src/task_review_types";

/** Responsibilities: _initial review dialogue_, _review cleanup dialogue_. **/
export class ReviewAgentDialogue implements ReviewAgentDialogueContract {
	private readonly _boundary_failures: SystemFailureClassificationContract;
	private readonly _review_documents: ReviewAgentFilesContract;
	private readonly _agent_catalog: ReviewAgentCatalogContract;
	private readonly _execution: ReviewAgentExecution;
	private readonly _request_plan: ReviewAgentDialoguePlan;

	/** Responsibilities: _review note sizes_. **/
	private async review_sizes_async(execution: ReviewAgentExecutionResult): Promise<ReviewAgentExecutionResult> {
		let current = execution;
		for (let attempt = 0; attempt < 2; attempt += 1) {
			const feedback = this._review_documents.size_feedback();
			if (feedback.length === 0) {
				return current;
			}
			current = await this.initial_dialogue_async(this._request_plan.size_feedback(feedback), false);
			if (current.provider === "none" || current.process.exit_code !== 0) {
				return current;
			}
		}
		return current;
	}

	/** Responsibilities: _parallel initial review dialogue_. **/
	private async initial_dialogue_async(prompt = "", reset = true): Promise<ReviewAgentExecutionResult> {
		if (reset) {
			this._review_documents.reset();
		}
		try {
			const dialogue = prompt.length === 0 ? "initial" : "initial-size";
			return await this._execution.run_dialogue_async({
				request: this._request_plan.initial_request(prompt),
				dialogue,
				phase: "initial",
			});
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
			const message = String(error);
			this._review_documents.write_failure(message);
			return this._execution.system_failure(message);
		}
	}

	/** Responsibilities: _review-agent dialogue initialization_. **/
	public constructor(options: ReviewAgentDialogueOptions) {
		this._review_documents = options.collaborators.review_documents;
		this._boundary_failures = new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES);
		this._agent_catalog = options.collaborators.agent_catalog;
		this._execution = new ReviewAgentExecution({
			selection: options.selection,
			root: options.execution.root,
			review_root: options.execution.review_root,
			hook_file: options.execution.hook_file,
			review_stage: options.stage.review_stage,
			review_prefix: options.stage.review_prefix,
			review_start_ms: options.stage.review_start_ms,
			debug_log: options.collaborators.debug_log,
			agent_catalog: this._agent_catalog,
			hooks: options.collaborators.hooks,
		});
		this._request_plan = new ReviewAgentDialoguePlan(options);
	}

	/** Responsibilities: _single initial review dialogue_. **/
	public async initial_async(): Promise<ReviewAgentExecutionResult> {
		const execution = await this.initial_dialogue_async("", false);
		if (execution.provider === "none" || execution.process.exit_code !== 0) {
			return execution;
		}
		return this.review_sizes_async(execution);
	}

	/** Responsibilities: _parallel review cleanup dialogue_. **/
	public async cleanup_dialogue_async(request: ReviewAgentRequest): Promise<ReviewAgentExecutionResult> {
		try {
			const prompt = this._agent_catalog.cleanup_prompt({ cleanup_request: request });
			return await this._execution.run_dialogue_async({
				request: { ...request, prompt },
				dialogue: "cleanup",
				phase: "cleanup",
			});
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
			const message = String(error);
			this._review_documents.write_failure(message);
			return this._execution.system_failure(message);
		}
	}
}
