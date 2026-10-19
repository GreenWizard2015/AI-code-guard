import { join } from "node:path";
import {
	REVIEW_COMPLETION_FILE,
	REVIEW_FAILURE_FILE,
	REVIEW_STATUS_RESOLVED,
} from "src/core/support/task/review-agent/constants";
import { REVIEW_COMPLETION_TEXT } from "src/core/support/task/review-agent/constants";
import { MAX_REVIEW_LINES, MIN_REVIEW_LINES } from "src/constants";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _review-agent findings_, _review-agent status files_. **/
export class ReviewAgentFiles {
	private readonly review_root: string;
	private readonly review_prefix: string;
	private readonly failure_file: string;
	private readonly completion_file: string;
	private readonly file_io: IOContract;

	/** Responsibilities: _review file discovery_. **/
	private review_files(): string[] {
		if (!this.file_io.file_paths.path_exists(this.review_root)) {
			return [];
		}
		const entries = this.file_io.directory_entries.list_entries(this.review_root);
		const markdown_files = entries.filter((file) => file.is_file && file.name.endsWith(".md"));
		const ordered_files = markdown_files.sort((left, right) => left.name.localeCompare(right.name));
		return ordered_files
			.filter((file) => file.name.startsWith(this.review_prefix))
			.map((file) => join(this.review_root, file.name));
	}

	/** Responsibilities: _review file paths_. **/
	public constructor(review_root: string, file_io: IOContract, review_prefix = "") {
		this.review_root = review_root;
		this.review_prefix = review_prefix;
		this.failure_file = join(review_root, REVIEW_FAILURE_FILE);
		this.completion_file = join(review_root, REVIEW_COMPLETION_FILE);
		this.file_io = file_io;
	}

	/** Responsibilities: _review findings_. **/
	public review_notes(): string[] {
		return this.review_files().filter((file) => {
			if (file === this.failure_file || file === this.completion_file) {
				return false;
			}
			const resolved = this.file_io.file_content
				.file_text(file)
				.split(/\r?\n/u)
				.some((line) => line.trim() === REVIEW_STATUS_RESOLVED);
			return !resolved;
		});
	}

	/** Responsibilities: _review note sizes_. **/
	public size_feedback(): string[] {
		const feedback: string[] = [];
		for (const file of this.review_notes()) {
			const lines = this.file_io.file_content.file_text(file).trimEnd().split(/\r?\n/u).length;
			if (lines < MIN_REVIEW_LINES) {
				feedback.push(
					`Review file ${file} has ${lines} lines and is too short. Expand it to at least ${MIN_REVIEW_LINES} lines with concrete evidence, architectural impact, and the required correction. Keep the confirmed finding; do not mark it resolved.`,
				);
				continue;
			}
			if (lines > MAX_REVIEW_LINES) {
				feedback.push(
					`Review file ${file} has ${lines} lines and is too long. Split it into focused review files, each no longer than ${MAX_REVIEW_LINES} lines. Keep every confirmed finding, then mark the original file Status: Resolved.`,
				);
			}
		}
		return feedback;
	}

	/** Responsibilities: _review workspace reset_. **/
	public reset(): void {
		this.file_io.directory_operations.create_directory(this.review_root);
		for (const file of [this.failure_file, this.completion_file]) {
			if (this.file_io.file_paths.path_exists(file)) {
				this.file_io.file_operations.remove_file(file);
			}
		}
	}

	/** Responsibilities: _review failure document_. **/
	public write_failure(message: string): void {
		this.file_io.directory_operations.create_directory(this.review_root);
		const text = [
			"# Architecture review agent failure",
			"",
			"## Status",
			`The selected architecture-review agent could not start or complete: ${message}.`,
			"",
			"## Impact",
			"The architecture review is incomplete.",
			"No clean-review conclusion may be inferred from this failure.",
			"The lint run therefore remains unsuccessful until the review is completed.",
			"",
			"## Required action",
			"Rerun the linter with the selected review provider.",
			"For Codex, use `ai-code-guard --review-agent codex`.",
			"Optionally select a provider model or reasoning effort before rerunning.",
			"",
			"## Scope",
			"This file records an agent lifecycle failure, not a confirmed architectural defect.",
			"Inspect the debug log in `.ai-code-guard/agent-debug.log` for process details.",
			"Keep this file until a successful review replaces it.",
			"",
		].join("\n");
		this.file_io.file_content.write_text(this.failure_file, text);
	}

	/** Responsibilities: _review completion document_. **/
	public write_completion(identity: string): void {
		this.file_io.directory_operations.create_directory(this.review_root);
		const text = [REVIEW_COMPLETION_TEXT, `Source identity: ${identity}`, ""].join("\n");
		this.file_io.file_content.write_text(this.completion_file, text);
	}
}
