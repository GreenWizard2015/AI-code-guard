import { MAX_REVIEW_LINES, MIN_REVIEW_LINES } from "src/constants";
import { ZERO_ISSUES_SUMMARY } from "src/core/support/task/review-agent/constants";
import type { TaskCleanReportContract, TaskReviewContract } from "src/task_protocols";

/** Responsibilities: _task review formatting_, _empty issue report formatting_. **/
export class TaskCleanReport implements TaskCleanReportContract {
	private readonly _review: TaskReviewContract;

	/** Responsibilities: _short-file notice collection_. **/
	private short_file_notices(): string[] {
		const notices: string[] = [];
		for (const file of this._review.files()) {
			if (this._review.file(file).line_count() >= MIN_REVIEW_LINES) {
				continue;
			}
			notices.push(`File ${file} is too short. Add concrete architectural details, evidence, and impact.`);
		}
		return notices;
	}

	/** Responsibilities: _pending review report_. **/
	private format_pending_review(): string {
		const notices = this.short_file_notices();
		const review_files = this._review.files();
		if (review_files.length === 0) {
			const lines = [...notices, ZERO_ISSUES_SUMMARY, this._review.primary_instruction()];
			return lines.join("\n\n");
		}
		for (const first of review_files) {
			return this.format_review(first, review_files.length, notices);
		}
		return this._review.primary_instruction();
	}

	/** Responsibilities: _review feedback composition_. **/
	private review_feedback(notices: readonly string[], total: number, body: string): string {
		const sections: string[] = [];
		for (const notice of notices) {
			sections.push(notice);
		}
		sections.push(`Total issues: ${total}.`, body);
		return sections.join("\n\n");
	}

	/** Responsibilities: _initialization task workspace documentation_. **/
	public constructor(review: TaskReviewContract) {
		this._review = review;
	}

	/** Responsibilities: _review report formatting_. **/
	public format_review(file: string, total: number, notices: readonly string[]): string {
		const review_file = this._review.file(file);
		if (review_file.line_count() < MIN_REVIEW_LINES) {
			const feedback = `${review_file.text()}\n\nFile ${file} is too short. Add concrete architectural details, evidence, and impact, then run \`ai-code-guard\` again.`;
			return this.review_feedback(notices, total, feedback);
		}
		if (review_file.line_count() > MAX_REVIEW_LINES) {
			const feedback = `File ${file} is too long. Split it into focused problems, mark the original file Status: Resolved, and run \`ai-code-guard\` again.`;
			return this.review_feedback(notices, total, feedback);
		}
		const feedback = `${review_file.text()}\n\nFix this problem, mark the file \`Status: Resolved\`, and run \`ai-code-guard\` again.`;
		return this.review_feedback(notices, total, feedback);
	}

	/** Responsibilities: _empty-issue report formatting_. **/
	public format(skip_review: boolean): string {
		if (skip_review) {
			const review_files = this._review.files();
			if (review_files.length === 0) {
				return ZERO_ISSUES_SUMMARY;
			}
		}
		if (this._review.completed()) {
			return [ZERO_ISSUES_SUMMARY, "Architecture review completed with no confirmed major defects."].join("\n");
		}
		return this.format_pending_review();
	}
}
