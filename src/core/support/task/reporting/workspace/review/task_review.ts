import { join, resolve } from "node:path";
import { TaskReviewFile } from "src/core/support/task/reporting/workspace/review/task_review_file";
import { ResolvedReviewArchive } from "src/core/support/task/resolved_review_archive";
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
import type { IOContract } from "src/io/protocols";
import type { TaskReviewContract, TaskReviewFileContract } from "src/task_protocols";

/** Responsibilities: _discovery architecture review files_, _completion verification_. **/
export class TaskReview implements TaskReviewContract {
	private readonly _completion_file_name: string;
	private readonly _failure_file_name: string;
	private readonly _completion_text: string;
	private readonly _review_root: string;
	private readonly _failure_file: string;
	private readonly _completion_file: string;
	private readonly _review_identity: ReviewStateIdentityContract;
	private readonly _archive: ResolvedReviewArchive;
	private readonly _file_io: IOContract;

	/** Responsibilities: _completion marker validation_. **/
	private completion_valid(): boolean {
		const lines = this._file_io.file(this._completion_file).file_text().trim().split("\n");
		if (lines[0] !== this._completion_text) {
			return false;
		}
		for (const line of lines) {
			if (!line.startsWith(REVIEW_SOURCE_IDENTITY_PREFIX)) {
				continue;
			}
			return this._review_identity.matches(line.slice(REVIEW_SOURCE_IDENTITY_PREFIX.length));
		}
		return false;
	}

	/** Responsibilities: _initialization review directory task_. **/
	public constructor(root: string, file_io: IOContract) {
		const project_root = resolve(root);
		this._completion_file_name = REVIEW_COMPLETION_FILE;
		this._failure_file_name = REVIEW_FAILURE_FILE;
		this._completion_text = REVIEW_COMPLETION_TEXT;
		this._review_root = join(project_root, AI_CODE_GUARD_DIRECTORY, REVIEW_DIRECTORY);
		this._failure_file = join(this._review_root, this._failure_file_name);
		this._completion_file = join(this._review_root, this._completion_file_name);
		this._file_io = file_io;
		this._archive = new ResolvedReviewArchive(project_root, file_io);
		this._review_identity = new ReviewStateIdentity(project_root, file_io);
	}

	/** Responsibilities: _review markdown files_. **/
	public files(): string[] {
		if (!this._file_io.file(this._review_root).path_exists()) {
			return [];
		}
		const entries = this._file_io.list_entries(this._review_root);
		const markdown_files = entries.filter((file) => {
			if (!file.is_file) {
				return false;
			}
			if (!file.name.endsWith(".md")) {
				return false;
			}
			return file.name !== this._completion_file_name && file.name !== this._failure_file_name;
		});
		const ordered_files = markdown_files.sort((left, right) => left.name.localeCompare(right.name));
		const review_paths = ordered_files.map((file) => join(this._review_root, file.name));
		return review_paths.filter((file) => this.file(file).active());
	}

	/** Responsibilities: _review file lookup_. **/
	public file(path: string): TaskReviewFileContract {
		return new TaskReviewFile(path, this._file_io, this._archive);
	}

	/** Responsibilities: _primary agent review assignment_. **/
	public primary_instruction(): string {
		if (this._file_io.file(this._failure_file).path_exists()) {
			return this._file_io.file(this._failure_file).file_text().trim();
		}
		return [
			REVIEW_NO_AGENT_MESSAGE,
			"Run `ai-code-guard --review-agent codex` or `ai-code-guard --review-agent claude`; optionally choose the provider model or reasoning effort.",
			"Architecture review instructions are sent directly to the selected review agent.",
			`Write review files to \`${this._review_root}/*.md\`.`,
			"At the end, a new review dialogue marks minor or speculative findings as Status: Resolved; resolved files are retained and ignored.",
		].join("\n\n");
	}

	/** Responsibilities: _architecture review completion verification_. **/
	public completed(): boolean {
		if (!this._file_io.file(this._completion_file).path_exists()) {
			return false;
		}
		if (this._file_io.file(this._failure_file).path_exists()) {
			return false;
		}
		if (!this.completion_valid()) {
			return false;
		}
		return this.files().length === 0;
	}
}
