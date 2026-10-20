import { join, resolve } from "node:path";
import {
	AI_CODE_GUARD_DIRECTORY,
	REVIEW_COMPLETION_FILE,
	REVIEW_COMPLETION_TEXT,
	REVIEW_DIRECTORY,
	REVIEW_FAILURE_FILE,
	REVIEW_NO_AGENT_MESSAGE,
	REVIEW_SOURCE_IDENTITY_PREFIX,
} from "src/core/support/task/review-agent/constants";
import type { ReviewStateIdentityContract } from "src/core/support/task/review-agent/protocols";
import { ReviewStateIdentity } from "src/core/support/task/review-agent/review_state_identity";
import { ResolvedReviewArchive } from "src/core/support/task/resolved_review_archive";
import type { TaskReviewContract } from "src/task_protocols";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _discovery architecture review files_, _completion verification_. **/
export class TaskReview implements TaskReviewContract {
	private readonly completion_file_name = REVIEW_COMPLETION_FILE;
	private readonly failure_file_name = REVIEW_FAILURE_FILE;
	private readonly completion_text = REVIEW_COMPLETION_TEXT;
	private readonly review_root: string;
	private readonly failure_file: string;
	private readonly completion_file: string;
	private readonly review_identity: ReviewStateIdentityContract;
	private readonly archive: ResolvedReviewArchive;
	private readonly file_io: IOContract;

	/** Responsibilities: _active review file selection_. **/
	private active_review_file(file: string): boolean {
		if (!this.file_io.file_paths.path_exists(file)) {
			return false;
		}
		return !this.archive.resolved(file);
	}

	/** Responsibilities: _completion marker validation_. **/
	private completion_valid(): boolean {
		const lines = this.file_io.file_content.file_text(this.completion_file).trim().split("\n");
		if (lines[0] !== this.completion_text) {
			return false;
		}
		for (const line of lines) {
			if (!line.startsWith(REVIEW_SOURCE_IDENTITY_PREFIX)) {
				continue;
			}
			return this.review_identity.matches(line.slice(REVIEW_SOURCE_IDENTITY_PREFIX.length));
		}
		return false;
	}

	/** Responsibilities: _initialization review directory task_. **/
	constructor(root: string, file_io: IOContract) {
		const project_root = resolve(root);
		this.review_root = join(project_root, AI_CODE_GUARD_DIRECTORY, REVIEW_DIRECTORY);
		this.failure_file = join(this.review_root, this.failure_file_name);
		this.completion_file = join(this.review_root, this.completion_file_name);
		this.file_io = file_io;
		this.archive = new ResolvedReviewArchive(project_root, file_io);
		this.review_identity = new ReviewStateIdentity(project_root, file_io);
	}

	/** Responsibilities: _review markdown files_. **/
	public files(): string[] {
		if (!this.file_io.file_paths.path_exists(this.review_root)) {
			return [];
		}
		const entries = this.file_io.directory_entries.list_entries(this.review_root);
		const markdown_files = entries.filter((file) => {
			if (!file.is_file) {
				return false;
			}
			if (!file.name.endsWith(".md")) {
				return false;
			}
			return file.name !== this.completion_file_name && file.name !== this.failure_file_name;
		});
		const ordered_files = markdown_files.sort((left, right) => left.name.localeCompare(right.name));
		const review_paths = ordered_files.map((file) => join(this.review_root, file.name));
		return review_paths.filter((file) => this.active_review_file(file));
	}

	/** Responsibilities: _review file line count_. **/
	public line_count(file: string): number {
		return this.file_io.file_content.file_text(file).trimEnd().split(/\r?\n/u).length;
	}

	/** Responsibilities: _review file text reading_. **/
	public text(file: string): string {
		return this.file_io.file_content.file_text(file).trim();
	}

	/** Responsibilities: _primary agent review assignment_. **/
	public primary_instruction(): string {
		if (this.file_io.file_paths.path_exists(this.failure_file)) {
			return this.file_io.file_content.file_text(this.failure_file).trim();
		}
		return [
			REVIEW_NO_AGENT_MESSAGE,
			"Run `ai-code-guard --review-agent codex` or `ai-code-guard --review-agent claude`; optionally choose the provider model or reasoning effort.",
			"Architecture review instructions are sent directly to the selected review agent.",
			`Write review files to \`${this.review_root}/*.md\`.`,
			"At the end, a new review dialogue marks minor or speculative findings as Status: Resolved; resolved files are retained and ignored.",
		].join("\n\n");
	}

	/** Responsibilities: _architecture review completion verification_. **/
	public completed(): boolean {
		if (!this.file_io.file_paths.path_exists(this.completion_file)) {
			return false;
		}
		if (this.file_io.file_paths.path_exists(this.failure_file)) {
			return false;
		}
		if (!this.completion_valid()) {
			return false;
		}
		return this.files().length === 0;
	}
}
