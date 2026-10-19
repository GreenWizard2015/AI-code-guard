import { join, resolve } from "node:path";
import { REVIEW_NO_AGENT_MESSAGE } from "src/core/support/task/review-agent/constants";
import { HOOK_AGENT_STOP } from "src/core/support/task/review-agent/constants";
import type {
	ReviewAgentCatalogContract,
	ReviewAgentHooksContract,
} from "src/core/support/task/review-agent/protocols";
import type {
	ReviewAgentDebugLogContract,
	ReviewAgentDialogueContract,
	ReviewAgentFilesContract,
	ReviewStateIdentityContract,
} from "src/core/support/task/review-agent/protocols";
import { ReviewAgentDebugLog } from "src/core/support/task/review-agent/review_agent_debug_log";
import { ReviewAgentDialogue } from "src/core/support/task/review-agent/dialogue/review_agent_dialogue";
import { ReviewAgentFiles } from "src/core/support/task/review-agent/review_agent_files";
import { ReviewRunLock } from "src/core/support/task/review-agent/review_run_lock";
import { NodeProcessSignal } from "src/core/support/task/review-agent/node_process_signal";
import { ReviewStateIdentity } from "src/core/support/task/review-agent/review_state_identity";
import type { ReviewHookPhase } from "src/core/support/task/review-agent/types";
import type { TaskReviewAgentOptions } from "src/core/support/task/review-agent/types";
import { TaskReviewDocumentation } from "src/core/support/task/task_review_documentation";
import { AI_CODE_GUARD_DIRECTORY, REPORTING_PROJECT_ROOT } from "src/constants";
import { REVIEW_STAGES } from "src/constants";
import type { IOContract } from "src/io/protocols";
import type { TaskReviewAgentContract, TaskReviewDocumentationContract } from "src/protocols";
import type {
	ReviewAgentExecutionResult,
	ReviewAgentHookEventContract,
	ReviewAgentHookEventName,
	ReviewAgentName,
	ReviewAgentProcessResult,
	ReviewAgentRequest,
	ReviewAgentRunOptions,
	ReviewAgentSelection,
	ReviewStageDefinition,
	TaskReviewRunResult,
} from "src/types";

/** Responsibilities: _architecture review-agent lifecycle_, _completion-file writing_. **/
export class TaskReviewAgent implements TaskReviewAgentContract {
	private readonly root: string;
	private readonly review_root: string;
	private readonly instruction: string;
	private readonly documentation: TaskReviewDocumentationContract;
	private readonly hook_file: string;
	private readonly hook_command: string;
	private readonly agent_catalog: ReviewAgentCatalogContract;
	private readonly review_documents: ReviewAgentFilesContract;
	private readonly review_identity: ReviewStateIdentityContract;
	private readonly debug_log: ReviewAgentDebugLogContract;
	private readonly hooks: ReviewAgentHooksContract;
	private readonly run_lock: ReviewRunLock;
	private readonly file_io: IOContract;

	/** Responsibilities: _review-agent request construction_. **/
	private agent_request(
		stage: ReviewStageDefinition,
		open_review_files: readonly string[],
		review_phase: ReviewHookPhase = "initial",
		prompt = "",
	): ReviewAgentRequest {
		return {
			root: this.root,
			instruction: this.instruction,
			review_root: this.review_root,
			hook: {
				hook_file: this.hook_file,
				hook_command: this.hook_command,
				review_prefix: stage.prefix,
				review_phase,
			},
			review_stage: stage.id,
			review_stage_plan: `${stage.id}: ${stage.prefix} ${stage.focus}`,
			open_review_files,
			prompt,
		};
	}

	/** Responsibilities: _review-agent lifecycle event_. **/
	private event(
		name: ReviewAgentHookEventName,
		selection: ReviewAgentSelection,
		process: ReviewAgentProcessResult,
		stage: ReviewStageDefinition,
	): ReviewAgentHookEventContract {
		return {
			event: name,
			provider: selection,
			root: this.root,
			review_root: this.review_root,
			hook_file: this.hook_file,
			review_stage: stage.id,
			review_prefix: stage.prefix,
			review_phase: "cleanup",
			tool_name: "",
			tool_input: "",
			exit_code: process.exit_code,
			stdout: process.stdout,
			stderr: process.stderr,
		};
	}

	/** Responsibilities: _review-agent termination_. **/
	private stop_agent(cleanup_result: ReviewAgentExecutionResult, stage: ReviewStageDefinition): TaskReviewRunResult {
		try {
			const decision = this.hooks.run(
				this.event(HOOK_AGENT_STOP, cleanup_result.provider, cleanup_result.process, stage),
			);
			if (!decision.allowed) {
				this.review_documents.write_failure(decision.reason);
				return { provider: "none", message: decision.reason };
			}
		} catch (error) {
			const message = String(error);
			this.review_documents.write_failure(message);
			return { provider: "none", message };
		}
		return { provider: cleanup_result.provider, message: cleanup_result.message };
	}

	/** Responsibilities: _review completion certification_, _source identity validation_. **/
	private complete_review(
		reviewed_identity: string,
		all_stages_selected: boolean,
		stop_result: TaskReviewRunResult,
	): TaskReviewRunResult {
		if (stop_result.provider === "none" || this.review_documents.review_notes().length > 0) {
			return stop_result;
		}
		if (!all_stages_selected) {
			return stop_result;
		}
		if (!this.review_identity.matches(reviewed_identity)) {
			const message = "Project source changed during architecture review";
			this.review_documents.write_failure(message);
			return { provider: "none", message };
		}
		this.review_documents.write_completion(reviewed_identity);
		return stop_result;
	}

	/** Responsibilities: _parallel review cleanup_. **/
	private async cleanup_parallel(
		selection: ReviewAgentName,
		dialogue: ReviewAgentDialogueContract,
		stage: ReviewStageDefinition,
		stage_documents: ReviewAgentFilesContract,
	): Promise<TaskReviewRunResult> {
		const cleanup_result = await dialogue.cleanup_dialogue_async(
			selection,
			this.agent_request(stage, stage_documents.review_notes(), "cleanup"),
		);
		if (cleanup_result.process.exit_code !== 0) {
			this.review_documents.write_failure(cleanup_result.message);
			return { provider: "none", message: cleanup_result.message };
		}
		return this.stop_agent(cleanup_result, stage);
	}

	/** Responsibilities: _parallel review cleanup_. **/
	private async finish_parallel(
		execution: ReviewAgentExecutionResult,
		dialogue: ReviewAgentDialogueContract,
		stage: ReviewStageDefinition,
		stage_documents: ReviewAgentFilesContract,
		review_cleanup: boolean,
	): Promise<TaskReviewRunResult> {
		if (execution.provider === "none") {
			this.review_documents.write_failure(execution.message);
			return { provider: execution.provider, message: execution.message };
		}
		if (execution.no_issues) {
			return this.stop_agent(execution, stage);
		}
		if (stage_documents.review_notes().length === 0) {
			return this.stop_agent(execution, stage);
		}
		if (!review_cleanup) {
			return this.stop_agent(execution, stage);
		}
		return this.cleanup_parallel(execution.provider, dialogue, stage, stage_documents);
	}

	/** Responsibilities: _review dialogue construction_. **/
	private create_dialogue(
		stage: ReviewStageDefinition,
		stage_documents: ReviewAgentFilesContract,
	): ReviewAgentDialogueContract {
		return new ReviewAgentDialogue({
			execution: {
				root: this.root,
				review_root: this.review_root,
				instruction: this.instruction,
				hook_file: this.hook_file,
				hook_command: this.hook_command,
			},
			stage: {
				review_stage: stage.id,
				review_prefix: stage.prefix,
				review_stage_plan: `${stage.id}: ${stage.prefix} ${stage.focus}`,
			},
			collaborators: {
				review_documents: stage_documents,
				debug_log: this.debug_log,
				agent_catalog: this.agent_catalog,
				hooks: this.hooks,
				io: this.file_io,
			},
		});
	}

	/** Responsibilities: _parallel review stage execution_. **/
	private async run_stage_parallel(
		selection: ReviewAgentSelection,
		stage: ReviewStageDefinition,
		review_cleanup: boolean,
	): Promise<TaskReviewRunResult> {
		const stage_documents = new ReviewAgentFiles(this.review_root, this.file_io, stage.prefix);
		const dialogue = this.create_dialogue(stage, stage_documents);
		try {
			return await this.complete_stage_parallel(selection, stage, review_cleanup, stage_documents, dialogue);
		} catch (error) {
			return this.stage_failure(String(error));
		}
	}

	/** Responsibilities: _stage execution completion_. **/
	private async complete_stage_parallel(
		selection: ReviewAgentSelection,
		stage: ReviewStageDefinition,
		review_cleanup: boolean,
		stage_documents: ReviewAgentFilesContract,
		dialogue: ReviewAgentDialogueContract,
	): Promise<TaskReviewRunResult> {
		const execution = await dialogue.initial_retry_async(selection);
		if (execution.provider === "none" || execution.process.exit_code !== 0) {
			this.review_documents.write_failure(execution.message);
			return { provider: "none", message: execution.message };
		}
		return this.finish_parallel(execution, dialogue, stage, stage_documents, review_cleanup);
	}

	/** Responsibilities: _stage failure recording_. **/
	private stage_failure(message: string): TaskReviewRunResult {
		try {
			this.review_documents.write_failure(message);
		} catch (write_error) {
			return { provider: "none", message: `${message}; ${String(write_error)}` };
		}
		return { provider: "none", message };
	}

	/** Responsibilities: _review stage selection_. **/
	private selected_review_stages(options: ReviewAgentRunOptions): ReviewStageDefinition[] {
		if (options.review_stages.length === 0) {
			return [...REVIEW_STAGES];
		}
		return REVIEW_STAGES.filter((stage) => options.review_stages.includes(stage.id));
	}

	/** Responsibilities: _parallel review execution_. **/
	private async run_locked_parallel(
		selection: ReviewAgentName,
		options: ReviewAgentRunOptions,
	): Promise<TaskReviewRunResult> {
		if (this.findings_present() && !options.force_review) {
			return { provider: "none", message: "Existing review findings require attention." };
		}
		this.debug_log.clear();
		this.review_documents.reset();
		const reviewed_identity = this.review_identity.value();
		const stages = this.selected_review_stages(options);
		const results = await Promise.all(
			stages.map((stage) => this.run_stage_parallel(selection, stage, options.review_cleanup)),
		);
		const failed = results.find((result) => result.provider === "none");
		if (failed !== undefined) {
			return failed;
		}
		return this.complete_review(reviewed_identity, stages.length === REVIEW_STAGES.length, {
			provider: selection,
			message: "Architecture review completed.",
		});
	}

	/** Responsibilities: _review-agent initialization_. **/
	constructor(options: TaskReviewAgentOptions) {
		this.root = resolve(options.root);
		this.review_root = join(this.root, AI_CODE_GUARD_DIRECTORY, "review");
		this.file_io = options.file_io;
		this.documentation = new TaskReviewDocumentation(REPORTING_PROJECT_ROOT, options.file_io);
		this.documentation.validate_review_documents();
		this.instruction = this.documentation.agent_instruction(this.review_root);
		this.hook_file = options.hook_file;
		this.hook_command = options.hook_command;
		this.review_documents = new ReviewAgentFiles(this.review_root, options.file_io);
		this.review_identity = new ReviewStateIdentity(this.root, options.file_io);
		this.debug_log = new ReviewAgentDebugLog(join(this.root, AI_CODE_GUARD_DIRECTORY), options.file_io);
		this.hooks = options.hooks;
		this.agent_catalog = options.agent_catalog;
		this.run_lock = new ReviewRunLock(this.root, options.file_io, new NodeProcessSignal());
	}

	/** Responsibilities: _architecture findings_. **/
	public findings_present(): boolean {
		return this.review_documents.review_notes().length > 0;
	}

	/** Responsibilities: _five concurrent review-agent stages_. **/
	public async run_parallel(
		selection: ReviewAgentSelection,
		options: ReviewAgentRunOptions,
	): Promise<TaskReviewRunResult> {
		if (selection === "none") {
			return { provider: "none", message: REVIEW_NO_AGENT_MESSAGE };
		}
		try {
			this.run_lock.acquire();
		} catch (error) {
			return { provider: "none", message: String(error) };
		}
		try {
			return await this.run_locked_parallel(selection, options);
		} finally {
			this.run_lock.release();
		}
	}
}
