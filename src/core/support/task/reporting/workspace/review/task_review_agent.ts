import { join, resolve } from "node:path";
import { AI_CODE_GUARD_DIRECTORY, REPORTING_PROJECT_ROOT, REVIEW_STAGES } from "src/constants";
import { TaskReviewAgentBatch } from "src/core/support/task/reporting/workspace/review/task_review_agent_batch";
import { TaskReviewDocumentation } from "src/core/support/task/reporting/workspace/review/task_review_documentation";
import { REVIEW_NO_AGENT_MESSAGE } from "src/core/support/task/review-agent/constants";
import { NodeProcessSignal } from "src/core/support/task/review-agent/process/node_process_signal";
import { ReviewAgentDebugLog } from "src/core/support/task/review-agent/process/review_agent_debug_log";
import type {
	ReviewAgentDebugLogContract,
	ReviewAgentFilesContract,
	ReviewStateIdentityContract,
} from "src/core/support/task/review-agent/protocols";
import { ReviewAgentFiles } from "src/core/support/task/review-agent/review_agent_files";
import { ReviewRunLock } from "src/core/support/task/review-agent/review_run_lock";
import { ReviewStateIdentity } from "src/core/support/task/review-agent/review_state_identity";
import type { TaskReviewAgentOptions } from "src/core/support/task/review-agent/types";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import type { TaskReviewAgentContract } from "src/task_protocols";
import type {
	ReviewAgentName,
	ReviewAgentPreparedRun,
	ReviewAgentSelection,
	TaskReviewRunResult,
} from "src/task_review_types";
import type { ReviewAgentRunOptions } from "src/task_types";

/** Responsibilities: _architecture review-agent lifecycle_, _completion-file writing_. **/
export class TaskReviewAgent implements TaskReviewAgentContract {
	private readonly _review_documents: ReviewAgentFilesContract;
	private readonly _review_identity: ReviewStateIdentityContract;
	private readonly _debug_log: ReviewAgentDebugLogContract;
	private readonly _stage_batch: TaskReviewAgentBatch;
	private readonly _run_lock: ReviewRunLock;

	/** Responsibilities: _review completion certification_, _source identity validation_. **/
	private complete_review(
		reviewed_identity: string,
		all_stages_selected: boolean,
		stop_result: TaskReviewRunResult,
	): TaskReviewRunResult {
		if (stop_result.provider === "none" || this._review_documents.review_notes().length > 0) {
			return stop_result;
		}
		if (!all_stages_selected) {
			return stop_result;
		}
		if (!this._review_identity.matches(reviewed_identity)) {
			const message = "Project source changed during architecture review";
			this._review_documents.write_failure(message);
			return { provider: "none", message };
		}
		this._review_documents.write_completion(reviewed_identity);
		return stop_result;
	}

	/** Responsibilities: _review-run preparation_. **/
	private prepare_review_run(review_stages: readonly string[]): ReviewAgentPreparedRun {
		this._debug_log.clear();
		this._review_documents.reset();
		const identity = this._review_identity.value();
		const stages = this._stage_batch.selected_review_stages(review_stages);
		return { identity, stages, review_start_ms: Date.now() };
	}

	/** Responsibilities: _parallel review execution_. **/
	private async run_locked_parallel(
		selection: ReviewAgentName,
		options: ReviewAgentRunOptions,
	): Promise<TaskReviewRunResult> {
		if (this.findings_present() && !options.force_review) {
			return { provider: "none", message: "Existing review findings require attention." };
		}
		const prepared = this.prepare_review_run(options.review_stages);
		const results = await this._stage_batch.run_stages_parallel({
			selection,
			stages: prepared.stages,
			review_cleanup: options.review_cleanup,
			review_start_ms: prepared.review_start_ms,
		});
		const failed = results.find((result) => result.provider === "none");
		if (failed !== undefined) {
			return failed;
		}
		return this.complete_review(prepared.identity, prepared.stages.length === REVIEW_STAGES.length, {
			provider: selection,
			message: "Architecture review completed.",
		});
	}

	/** Responsibilities: _review-agent initialization_. **/
	public constructor(options: TaskReviewAgentOptions) {
		const root = resolve(options.root);
		const review_root = join(root, AI_CODE_GUARD_DIRECTORY, "review");
		const documentation = new TaskReviewDocumentation(REPORTING_PROJECT_ROOT, options.file_io);
		documentation.validate_review_documents();
		const review_documents = new ReviewAgentFiles(review_root, options.file_io, "", Number.NEGATIVE_INFINITY);
		this._review_documents = review_documents;
		this._review_identity = new ReviewStateIdentity(root, options.file_io);
		this._debug_log = new ReviewAgentDebugLog(join(root, AI_CODE_GUARD_DIRECTORY), options.file_io);
		this._stage_batch = new TaskReviewAgentBatch({
			execution: {
				root,
				review_root,
				instruction: documentation.agent_instruction(review_root),
				hook_file: options.hook_file,
				hook_command: options.hook_command,
			},
			collaborators: {
				boundary_failures: new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES),
				review_documents,
				debug_log: this._debug_log,
				agent_catalog: options.agent_catalog,
				hooks: options.hooks,
				file_io: options.file_io,
			},
		});
		this._run_lock = new ReviewRunLock(
			root,
			options.file_io,
			new NodeProcessSignal(process, options.file_io, process.platform),
		);
	}

	/** Responsibilities: _architecture findings_. **/
	public findings_present(): boolean {
		return this._review_documents.review_notes().length > 0;
	}

	/** Responsibilities: _five concurrent review-agent stages_. **/
	public async run_parallel(
		selection: ReviewAgentSelection,
		options: ReviewAgentRunOptions,
	): Promise<TaskReviewRunResult> {
		if (selection === "none") {
			return { provider: "none", message: REVIEW_NO_AGENT_MESSAGE };
		}
		if (!this._run_lock.try_acquire()) {
			return { provider: "none", message: "Another architecture review process owns the project lock." };
		}
		try {
			return await this.run_locked_parallel(selection, options);
		} finally {
			this._run_lock.release();
		}
	}
}
