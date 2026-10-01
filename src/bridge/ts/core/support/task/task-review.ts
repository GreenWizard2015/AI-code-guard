import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { TaskReviewCompletionCode } from "src/bridge/ts/core/support/task/task-review-completion-code";
import type { TaskReviewCompletionCodeProtocol } from "src/protocols";

/** Responsibilities: _discovery architecture review files_. **/
export class TaskReview {
	private readonly review_root: string;
	private readonly instruction_file: string;
	private readonly completion_code_service: TaskReviewCompletionCodeProtocol = new TaskReviewCompletionCode();
	private readonly current_time = new Date();
	public readonly completion_code = this.completion_code_service.completion_code(this.current_time);

	/** Responsibilities: _initialization review directory task_. **/
	constructor(root: string) {
		this.review_root = join(resolve(root, ".ai-code-guard"), "review");
		this.instruction_file = join(resolve(root, ".ai-code-guard"), "architecture-review-agent.md");
	}

	/** Responsibilities: _review markdown files_. **/
	public files(): string[] {
		if (!existsSync(this.review_root)) {
			return [];
		}
		const entries = readdirSync(this.review_root, { withFileTypes: true });
		const markdown_files = entries.filter((file) => file.isFile() && file.name.endsWith(".md"));
		const ordered_files = markdown_files.sort((left, right) => left.name.localeCompare(right.name));
		const review_paths = ordered_files.map((file) => join(this.review_root, file.name));
		const existing_paths = review_paths.filter((file) => existsSync(file));
		return existing_paths;
	}

	/** Responsibilities: _review file line count_. **/
	public line_count(file: string): number {
		return readFileSync(file, "utf8").split(/\r?\n/u).length;
	}

	/** Responsibilities: _review file text reading_. **/
	public text(file: string): string {
		return readFileSync(file, "utf8").trim();
	}

	/** Responsibilities: _primary agent review assignment_. **/
	public primary_instruction(): string {
		return [
			`Architecture review instruction is in file \`${this.instruction_file}\`.`,
			`Write review files to \`${this.review_root}/*.md\`.`,
			`Primary agent private completion code (do not delegate): ${this.completion_code}`,
		].join("\n\n");
	}

	/** Responsibilities: _architecture review completion verification_. **/
	public completed(): boolean {
		const review_files = this.files();
		if (review_files.length === 0) {
			return false;
		}
		const completed_files = review_files.filter((file) =>
			this.completion_code_service.contains(this.text(file), this.current_time),
		);
		return completed_files.length > 0;
	}
}
