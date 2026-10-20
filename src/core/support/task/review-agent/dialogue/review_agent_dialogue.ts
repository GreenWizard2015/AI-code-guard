import type { ReviewAgentDialogueOptions } from "src/core/support/task/review-agent/types";
import type {
	ReviewAgentCatalogContract,
	ReviewAgentFilesContract,
} from "src/core/support/task/review-agent/protocols";
import type { ReviewAgentExecutionResult, ReviewAgentName, ReviewAgentRequest, ReviewAgentSelection } from "src/types";
import { ReviewAgentExecution } from "src/core/support/task/review-agent/dialogue/review_agent_execution";
import { ReviewAgentDialoguePlan } from "src/core/support/task/review-agent/dialogue/review_agent_dialogue_plan";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";

/** Responsibilities: _initial review dialogue_, _review cleanup dialogue_. **/
export class ReviewAgentDialogue {
	private readonly boundary_failures: BoundaryFailureClassifier;
	private readonly review_documents: ReviewAgentFilesContract;
	private readonly agent_catalog: ReviewAgentCatalogContract;
	private readonly execution: ReviewAgentExecution;
	private readonly request_plan: ReviewAgentDialoguePlan;

	/** Responsibilities: _review note sizes_. **/
	private async review_sizes_async(
		selection: ReviewAgentSelection,
		execution: ReviewAgentExecutionResult,
	): Promise<ReviewAgentExecutionResult> {
		let current = execution;
		for (let attempt = 0; attempt < 2; attempt += 1) {
			const feedback = this.review_documents.size_feedback();
			if (feedback.length === 0) {
				return current;
			}
			current = await this.initial_dialogue_async(selection, this.request_plan.size_feedback(feedback), false);
			if (current.provider === "none" || current.process.exit_code !== 0) {
				return current;
			}
		}
		return current;
	}

	/** Responsibilities: _parallel initial review dialogue_. **/
	private async initial_dialogue_async(
		selection: ReviewAgentSelection,
		prompt = "",
		reset = true,
	): Promise<ReviewAgentExecutionResult> {
		if (reset) {
			this.review_documents.reset();
		}
		try {
			const dialogue = prompt.length === 0 ? "initial" : "initial-size";
			return await this.execution.initial_dialogue_async(
				selection,
				this.request_plan.initial_request(prompt),
				dialogue,
			);
		} catch (error) {
			if (!this.boundary_failures.system_failure_message(String(error))) {
				throw error;
			}
			const message = String(error);
			this.review_documents.write_failure(message);
			return this.execution.system_failure(message);
		}
	}

	/** Responsibilities: _review-agent dialogue initialization_. **/
	constructor(options: ReviewAgentDialogueOptions) {
		this.review_documents = options.collaborators.review_documents;
		this.boundary_failures = new BoundaryFailureClassifier();
		this.agent_catalog = options.collaborators.agent_catalog;
		this.execution = new ReviewAgentExecution({
			root: options.execution.root,
			review_root: options.execution.review_root,
			hook_file: options.execution.hook_file,
			review_stage: options.stage.review_stage,
			review_prefix: options.stage.review_prefix,
			debug_log: options.collaborators.debug_log,
			agent_catalog: this.agent_catalog,
			hooks: options.collaborators.hooks,
		});
		this.request_plan = new ReviewAgentDialoguePlan(options);
	}

	/** Responsibilities: _parallel initial review continuity_. **/
	public async initial_retry_async(selection: ReviewAgentSelection): Promise<ReviewAgentExecutionResult> {
		const first_execution = await this.initial_dialogue_async(selection, "", false);
		if (first_execution.provider === "none" || first_execution.process.exit_code !== 0) {
			return first_execution;
		}
		if (this.review_documents.review_notes().length > 0) {
			return this.review_sizes_async(selection, first_execution);
		}
		const retry_execution = await this.initial_dialogue_async(selection, "", false);
		if (retry_execution.provider === "none" || retry_execution.process.exit_code !== 0) {
			return retry_execution;
		}
		return this.review_sizes_async(selection, retry_execution);
	}

	/** Responsibilities: _parallel review cleanup dialogue_. **/
	public async cleanup_dialogue_async(
		selection: ReviewAgentName,
		request: ReviewAgentRequest,
	): Promise<ReviewAgentExecutionResult> {
		try {
			const prompt = this.agent_catalog.cleanup_prompt({ cleanup_request: request });
			return await this.execution.cleanup_async(selection, { ...request, prompt });
		} catch (error) {
			if (!this.boundary_failures.system_failure_message(String(error))) {
				throw error;
			}
			const message = String(error);
			this.review_documents.write_failure(message);
			return this.execution.system_failure(message);
		}
	}
}
