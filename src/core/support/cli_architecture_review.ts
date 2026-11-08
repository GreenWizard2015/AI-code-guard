import type { ViolationContract } from "src/reporting_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { TaskReportingContract } from "src/task_protocols";
import type { TaskReviewRunResult } from "src/task_review_types";
import type { CliOptions, ReviewStatus } from "src/task_types";

/** Responsibilities: _review eligibility_, _review execution_, _exit status_. **/
export class CliArchitectureReview {
	private readonly _task_reporting: TaskReportingContract;
	private readonly _stage_timer: LintStageTimerContract;

	/** Responsibilities: _review execution_. **/
	private async run_architecture_review(
		options: CliOptions,
		violations: readonly ViolationContract[],
		review_pending: boolean,
	): Promise<TaskReviewRunResult> {
		const agent_selected = options.review_agent !== "none";
		let report_is_clean = options.force_review;
		if (violations.length === 0) {
			report_is_clean = true;
		}
		if (review_pending && agent_selected && report_is_clean) {
			return this._stage_timer.measure_async("architecture-review", () =>
				this._task_reporting.run_review_agent(options.review_agent, {
					force_review: options.force_review,
					review_stages: options.review_stages,
				}),
			);
		}
		return { provider: "none", message: "Architecture review was not requested." };
	}

	/** Responsibilities: _review dependency initialization_. **/
	public constructor(task_reporting: TaskReportingContract, stage_timer: LintStageTimerContract) {
		this._task_reporting = task_reporting;
		this._stage_timer = stage_timer;
	}

	/** Responsibilities: _review status collection_. **/
	public async status(options: CliOptions, violations: readonly ViolationContract[]): Promise<ReviewStatus> {
		const initial_review_state = this._task_reporting.review_status();
		const review_is_eligible = violations.length === 0 && !initial_review_state.completed;
		let review_pending = false;
		if (options.review_agent !== "none") {
			review_pending = options.force_review;
			if (!review_pending && review_is_eligible) {
				review_pending = true;
			}
		}
		const review_result = await this.run_architecture_review(options, violations, review_pending);
		const failed = review_pending && review_result.provider === "none";
		const review_state = this._task_reporting.review_status();
		return {
			required: review_pending,
			active: review_state.active,
			completed: review_state.completed,
			failed,
		};
	}

	/** Responsibilities: _review exit status_. **/
	public must_fail(status: ReviewStatus): boolean {
		if (status.active || status.failed) {
			return true;
		}
		if (!status.required) {
			return false;
		}
		return !status.completed;
	}
}
