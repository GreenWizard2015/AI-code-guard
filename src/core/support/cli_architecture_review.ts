import type { LintStageTimerContract, TaskReportingContract } from "src/protocols";
import type { CliOptions, ReportViolation, ReviewStatus, TaskReviewRunResult } from "src/types";

/** Responsibilities: _review eligibility_, _execution_, _exit status_. **/
export class CliArchitectureReview {
	private readonly task_reporting: TaskReportingContract;
	private readonly stage_timer: LintStageTimerContract;

	/** Responsibilities: _review eligibility_. **/
	private review_ready(options: CliOptions, violations: readonly ReportViolation[], review_pending: boolean): boolean {
		if (!review_pending) {
			return false;
		}
		const has_violations = violations.length !== 0;
		const review_not_forced = !options.force_review;
		if (has_violations && review_not_forced) {
			return false;
		}
		return options.review_agent !== "none";
	}

	/** Responsibilities: _review request decision_. **/
	private review_requested(options: CliOptions, violations: readonly ReportViolation[]): boolean {
		if (options.review_agent === "none") {
			return false;
		}
		if (options.force_review) {
			return true;
		}
		return this.task_reporting.review_requested(violations);
	}

	/** Responsibilities: _review execution_. **/
	private async run_architecture_review(
		options: CliOptions,
		violations: readonly ReportViolation[],
		review_pending: boolean,
	): Promise<TaskReviewRunResult> {
		if (!this.review_ready(options, violations, review_pending)) {
			return { provider: "none", message: "Architecture review was not requested." };
		}
		return this.stage_timer.measure_async("architecture-review", () =>
			this.task_reporting.run_review_agent(options.review_agent, {
				review_cleanup: options.review_cleanup,
				force_review: options.force_review,
				review_stages: options.review_stages,
			}),
		);
	}

	/** Responsibilities: _review dependency initialization_. **/
	public constructor(task_reporting: TaskReportingContract, stage_timer: LintStageTimerContract) {
		this.task_reporting = task_reporting;
		this.stage_timer = stage_timer;
	}

	/** Responsibilities: _review status collection_. **/
	public async status(options: CliOptions, violations: readonly ReportViolation[]): Promise<ReviewStatus> {
		const review_pending = this.review_requested(options, violations);
		const review_result = await this.run_architecture_review(options, violations, review_pending);
		const review_state = this.task_reporting.review_status();
		let failed = false;
		if (review_pending) {
			failed = review_result.provider === "none";
		}
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
