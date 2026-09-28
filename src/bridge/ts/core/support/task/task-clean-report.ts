import type { TaskDocumentationProtocol, TaskReviewProtocol, TaskWorkspaceProtocol } from 'src/protocols';
import { MAX_REVIEW_LINES, MIN_REVIEW_LINES } from 'src/constants';

/** Responsibilities: _task report formatting_. **/
export class TaskCleanReport {
	private readonly workspace: TaskWorkspaceProtocol;
	private readonly documentation: TaskDocumentationProtocol;
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

	/** Responsibilities: _empty review reporting_. **/
	private no_review_report(notices: readonly string[]): string {
		return [
			...notices,
			'Total issues: 0.\nTotal files: 0.',
			this.documentation.philosophy(),
			this.review.instruction(),
		].join('\n\n');
	}

	/** Responsibilities: _initialization task workspace documentation_. **/
	public constructor(workspace: TaskWorkspaceProtocol, documentation: TaskDocumentationProtocol, review: TaskReviewProtocol) {
		this.workspace = workspace;
		this.documentation = documentation;
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
			].join('\n\n');
		}
		if (this.review.line_count(file) > MAX_REVIEW_LINES) {
			return [
				...notices,
				`Total issues: ${total}.`,
				`File ${file} is too long. Split it into focused problems, delete the file, and run \`ai-code-guard\` again.`,
			].join('\n\n');
		}
		return [
			...notices,
			`Total issues: ${total}.`,
			this.review.text(file),
			`Fix this problem, delete the file ${file}, and run \`ai-code-guard\` again.`,
		].join('\n\n');
	}

	/** Responsibilities: _empty-issue report formatting_. **/
	public format(): string {
		this.workspace.clear_batch();
		const notices = this.short_file_notices();
		const review_files = this.review.files();
		if (review_files.length === 0) {
			return this.no_review_report(notices);
		}
		if (this.review.completed()) {
			return ['Total issues: 0.', 'Total files: 0.', 'Architecture review completion code verified.'].join('\n');
		}
		const first = review_files[0];
		return this.format_review(first, review_files.length, notices);
	}
}
