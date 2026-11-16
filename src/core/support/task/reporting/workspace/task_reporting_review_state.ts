import { TaskCleanReport } from "src/core/support/task/reporting/workspace/review/task_clean_report";
import { TaskReview } from "src/core/support/task/reporting/workspace/review/task_review";
import { TaskReviewAgent } from "src/core/support/task/reporting/workspace/review/task_review_agent";
import { ResolvedReviewArchive } from "src/core/support/task/resolved_review_archive";
import { TaskReviewAgentRuntime } from "src/core/support/task/review-agent/task_review_agent_runtime";
import { TaskWorkspace } from "src/core/task_workspace";
import type { CallableReviewAgentProvider } from "src/core/types";
import type { IOContract } from "src/io/protocols";
import type {
	ResolvedReviewArchiveContract,
	TaskCleanReportContract,
	TaskReportingReviewStateContract,
	TaskReviewAgentContract,
	TaskReviewContract,
} from "src/task_protocols";
import type { ReviewAgentSelection, TaskReviewRunResult } from "src/task_review_types";
import type { ReviewAgentRunOptions, ReviewStatus, TaskReportingReviewPreparation } from "src/task_types";

/** Responsibilities: _review session state_, _review report preparation_. **/
export class TaskReportingReviewState implements TaskReportingReviewStateContract {
	private readonly _root: string;
	private readonly _file_io: IOContract;
	private readonly _workspace: TaskWorkspace;
	private readonly _review: TaskReviewContract;
	private readonly _review_agent: CallableReviewAgentProvider;
	private readonly _review_archive: ResolvedReviewArchiveContract;
	private readonly _clean_report: TaskCleanReportContract;

	/** Responsibilities: _lazy review-agent construction_. **/
	private create_review_agent(): TaskReviewAgentContract {
		const runtime = new TaskReviewAgentRuntime(this._root, this._file_io);
		const hooks = runtime.hook_configuration();
		return new TaskReviewAgent({
			root: this._root,
			agent_catalog: runtime.catalog(),
			hooks: hooks.hooks,
			hook_command: hooks.command,
			hook_file: hooks.file,
			file_io: this._file_io,
		});
	}

	/** Responsibilities: _review state initialization_. **/
	public constructor(root: string, file_io: IOContract) {
		this._root = root;
		this._file_io = file_io;
		this._workspace = new TaskWorkspace(root, file_io);
		this._review = new TaskReview(root, file_io);
		this._review_archive = new ResolvedReviewArchive(root, file_io);
		this._clean_report = new TaskCleanReport(this._review);
		let get_review_agent = (): TaskReviewAgentContract => {
			const review_agent = this.create_review_agent();
			get_review_agent = () => review_agent;
			return review_agent;
		};
		this._review_agent = () => get_review_agent();
	}

	/** Responsibilities: _architecture review status_. **/
	public review_status(): ReviewStatus {
		return {
			required: false,
			active: this._review.files().length > 0,
			completed: this._review.completed(),
			failed: false,
		};
	}

	/** Responsibilities: _review report preparation_. **/
	public prepare_report(skip_review: boolean): TaskReportingReviewPreparation {
		this._review_archive.archive_resolved_reviews();
		return {
			review_files: this._review.files(),
			clean_report: this._clean_report.format(skip_review),
		};
	}

	/** Responsibilities: _review agent execution_. **/
	public run_review_agent(
		selection: ReviewAgentSelection,
		options: ReviewAgentRunOptions,
	): Promise<TaskReviewRunResult> {
		this._workspace.prepare_review();
		return this._review_agent().run_parallel(selection, options);
	}
}
