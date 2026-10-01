import { MAX_REVIEW_LINES, MIN_REVIEW_LINES } from "src/constants";
import type { TaskReviewProtocol, TaskWorkspaceProtocol } from "src/protocols";

/** Responsibilities: _task report formatting_. **/
export class TaskCleanReport {
	private readonly workspace: TaskWorkspaceProtocol;
	private readonly review: TaskReviewProtocol;

	/** Responsibilities: _short-file notice collection_. **/
	private short_file_notices(): string[] {
		const notices: string[] = [];
		for (const file of this.review.files()) {
			if (this.review.line_count(file) >= MIN_REVIEW_LINES) {
				continue;
			}
			notices.push(`File ${file} is too short. Add concrete architectural details, evidence, and impact.`);
		}
		return notices;
	}

	/** Responsibilities: _initialization task workspace documentation_. **/
	public constructor(workspace: TaskWorkspaceProtocol, review: TaskReviewProtocol) {
		this.workspace = workspace;
		this.review = review;
	}

	/** Responsibilities: _review report formatting_. **/
	public format_review(file: string, total: number, notices: readonly string[]): string {
		if (this.review.line_count(file) < MIN_REVIEW_LINES) {
			return [
				...notices,
				`Total issues: ${total}.`,
				this.review.text(file),
				`File ${file} is too short. Add concrete architectural details, evidence, and impact, then run \`ai-code-guard\` again.`,
			].join("\n\n");
		}
		if (this.review.line_count(file) > MAX_REVIEW_LINES) {
			return [
				...notices,
				`Total issues: ${total}.`,
				`File ${file} is too long. Split it into focused problems, delete the file, and run \`ai-code-guard\` again.`,
			].join("\n\n");
		}
		return [
			...notices,
			`Total issues: ${total}.`,
			this.review.text(file),
			`Fix this problem, delete the file ${file}, and run \`ai-code-guard\` again.`,
		].join("\n\n");
	}

	/** Responsibilities: _empty-issue report formatting_. **/
	public format(skip_review: boolean): string {
		this.workspace.clear_batch();
		if (skip_review) {
			return "Total issues: 0.\nTotal files: 0.";
		}
		if (this.review.completed()) {
			return ["Total issues: 0.", "Total files: 0.", "Architecture review completion code verified."].join("\n");
		}
		const notices = this.short_file_notices();
		const review_files = this.review.files();
		if (review_files.length === 0) {
			return [...notices, "Total issues: 0.\nTotal files: 0.", this.review.primary_instruction()].join("\n\n");
		}
		const first = review_files[0];
		return this.format_review(first, review_files.length, notices);
	}
}
