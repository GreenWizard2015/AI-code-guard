import { BoundaryFailureCategory } from "src/analysis_protocols";
import { REVIEW_STAGES } from "src/constants";
import { TaskReviewAgentStageExecution } from "src/core/support/task/reporting/workspace/review/task_review_agent_stage_execution";
import { ReviewAgentDialogue } from "src/core/support/task/review-agent/dialogue/review_agent_dialogue";
import type {
	ReviewAgentDialogueContract,
	ReviewAgentFilesContract,
	TaskReviewAgentStageExecutionContract,
} from "src/core/support/task/review-agent/protocols";
import { ReviewAgentFiles } from "src/core/support/task/review-agent/review_agent_files";
import type { TaskReviewAgentBatchOptions } from "src/core/support/task/review-agent/types";
import type {
	ReviewAgentName,
	ReviewAgentStageBatchRequest,
	ReviewAgentStageRunRequest,
	ReviewStageDefinition,
	TaskReviewRunResult,
} from "src/task_review_types";

/** Responsibilities: _parallel review-stage coordination_, _stage dialogue construction_. **/
export class TaskReviewAgentBatch {
	private readonly _options: TaskReviewAgentBatchOptions;

	/** Responsibilities: _stage dialogue construction_. **/
	private stage_dialogue(
		selection: ReviewAgentName,
		stage: ReviewStageDefinition,
		stage_documents: ReviewAgentFilesContract,
		review_start_ms: number,
	): ReviewAgentDialogueContract {
		const { execution, collaborators } = this._options;
		const { root, review_root, instruction, hook_file, hook_command } = execution;
		const { debug_log, agent_catalog, hooks, file_io } = collaborators;
		return new ReviewAgentDialogue({
			selection,
			execution: { root, review_root, instruction, hook_file, hook_command },
			stage: {
				review_stage: stage.id,
				review_prefix: stage.prefix,
				review_stage_plan: `${stage.id}: ${stage.prefix} ${stage.focus}`,
				review_start_ms,
			},
			collaborators: {
				review_documents: stage_documents,
				debug_log,
				agent_catalog,
				hooks,
				io: file_io,
			},
		});
	}

	/** Responsibilities: _stage execution state_. **/
	private stage_execution(request: ReviewAgentStageRunRequest): TaskReviewAgentStageExecutionContract {
		const { selection, stage, review_start_ms } = request;
		const { execution, collaborators } = this._options;
		const stage_documents = new ReviewAgentFiles(
			execution.review_root,
			collaborators.file_io,
			stage.prefix,
			review_start_ms,
		);
		const dialogue = this.stage_dialogue(selection, stage, stage_documents, review_start_ms);
		return new TaskReviewAgentStageExecution({
			request_context: { ...execution, stage, selection, review_start_ms },
			collaborators: { ...collaborators, dialogue },
		});
	}

	/** Responsibilities: _stage execution failure handling_. **/
	private stage_failure(message: string): TaskReviewRunResult {
		const { boundary_failures, review_documents } = this._options.collaborators;
		try {
			review_documents.write_failure(message);
		} catch (write_error) {
			if (!boundary_failures.check(String(write_error), BoundaryFailureCategory.System)) {
				throw write_error;
			}
			return { provider: "none", message: `${message}; ${String(write_error)}` };
		}
		return { provider: "none", message };
	}

	/** Responsibilities: _stage execution_. **/
	private async run_stage(request: ReviewAgentStageRunRequest): Promise<TaskReviewRunResult> {
		const { boundary_failures } = this._options.collaborators;
		try {
			const execution = this.stage_execution(request);
			return await execution.run();
		} catch (error) {
			if (!boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
			return this.stage_failure(String(error));
		}
	}

	/** Responsibilities: _batch initialization_. **/
	public constructor(options: TaskReviewAgentBatchOptions) {
		this._options = options;
	}

	/** Responsibilities: _review stage selection_. **/
	public selected_review_stages(review_stages: readonly string[]): ReviewStageDefinition[] {
		if (review_stages.length === 0) {
			return [...REVIEW_STAGES];
		}
		return REVIEW_STAGES.filter((stage) => review_stages.includes(stage.id));
	}

	/** Responsibilities: _parallel stage result aggregation_. **/
	public async run_stages_parallel(request: ReviewAgentStageBatchRequest): Promise<TaskReviewRunResult[]> {
		const settled = await Promise.allSettled(
			request.stages.map((stage) =>
				this.run_stage({
					selection: request.selection,
					stage,
					review_start_ms: request.review_start_ms,
				}),
			),
		);
		const results: TaskReviewRunResult[] = [];
		for (const result of settled) {
			if (result.status === "fulfilled") {
				results.push(result.value);
				continue;
			}
			results.push(this.stage_failure(String(result.reason)));
		}
		return results;
	}
}
