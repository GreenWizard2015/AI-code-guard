import { join } from "node:path";
import { MAX_REVIEW_LINES, MIN_REVIEW_LINES } from "src/constants";
import {
	REVIEW_COMPLETION_FILE,
	REVIEW_FAILURE_FILE,
	REVIEW_STATUS_RESOLVED,
} from "src/core/support/task/review-agent/constants";
import { REVIEW_COMPLETION_TEXT } from "src/core/support/task/review-agent/constants";
import type { ReviewAgentFilesContract } from "src/core/support/task/review-agent/protocols";
import { ReviewFindingDocument } from "src/core/support/task/review-agent/review_finding_document";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _review-agent findings_, _review-agent status files_. **/
export class ReviewAgentFiles implements ReviewAgentFilesContract {
	private readonly _review_root: string;
	private readonly _review_prefix: string;
	private readonly _failure_file: string;
	private readonly _completion_file: string;
	private readonly _file_io: IOContract;
	private readonly _review_start_ms: number;

	/** Responsibilities: _review file discovery_. **/
	private review_files(): string[] {
		if (!this._file_io.file(this._review_root).path_exists()) {
			return [];
		}
		const entries = this._file_io.list_entries(this._review_root);
		const markdown_files = entries.filter((file) => file.is_file && file.name.endsWith(".md"));
		const ordered_files = markdown_files.sort((left, right) => left.name.localeCompare(right.name));
		return ordered_files
			.filter((file) => file.name.startsWith(this._review_prefix))
			.map((file) => join(this._review_root, file.name));
	}

	/** Responsibilities: _review file paths_. **/
	public constructor(review_root: string, file_io: IOContract, review_prefix: string, review_start_ms: number) {
		this._review_root = review_root;
		this._review_prefix = review_prefix;
		this._failure_file = join(review_root, REVIEW_FAILURE_FILE);
		this._completion_file = join(review_root, REVIEW_COMPLETION_FILE);
		this._file_io = file_io;
		this._review_start_ms = review_start_ms;
	}

	/** Responsibilities: _review findings_. **/
	public review_notes(): string[] {
		return this.review_files().filter((file) => {
			if (file === this._failure_file || file === this._completion_file) {
				return false;
			}
			const text = this._file_io.file(file).file_text();
			const finding_document = new ReviewFindingDocument(text);
			const status = finding_document.status();
			return status !== REVIEW_STATUS_RESOLVED;
		});
	}

	/** Responsibilities: _current-run findings_. **/
	public current_review_notes(): string[] {
		return this.review_notes().filter((file) => {
			const modified_at_ms = this._file_io.file(file).metadata().mtime_ms;
			return modified_at_ms > this._review_start_ms;
		});
	}

	/** Responsibilities: _review note sizes_. **/
	public size_feedback(): string[] {
		const feedback: string[] = [];
		for (const file of this.current_review_notes()) {
			const document = new ReviewFindingDocument(this._file_io.file(file).file_text());
			const lines = document.line_count();
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
		this._file_io.create_directory(this._review_root);
		for (const file of [this._failure_file, this._completion_file]) {
			if (this._file_io.file(file).path_exists()) {
				this._file_io.file(file).remove_file();
			}
		}
	}

	/** Responsibilities: _review failure document_. **/
	public write_failure(message: string): void {
		this._file_io.create_directory(this._review_root);
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
		this._file_io.file(this._failure_file).write_text(text);
	}

	/** Responsibilities: _review completion document_. **/
	public write_completion(identity: string): void {
		this._file_io.create_directory(this._review_root);
		const text = [REVIEW_COMPLETION_TEXT, `Source identity: ${identity}`, ""].join("\n");
		this._file_io.file(this._completion_file).write_text(text);
	}
}
