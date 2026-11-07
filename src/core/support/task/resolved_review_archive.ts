import { join, resolve } from "node:path";
import {
	AI_CODE_GUARD_DIRECTORY,
	RESOLVED_REVIEW_DIRECTORY,
	REVIEW_COMPLETION_FILE,
	REVIEW_DIRECTORY,
	REVIEW_FAILURE_FILE,
	REVIEW_STATUS_RESOLVED,
} from "src/core/support/task/review-agent/constants";
import { ReviewFindingDocument } from "src/core/support/task/review-agent/review_finding_document";
import type { IOContract } from "src/io/protocols";
import type { ResolvedReviewArchiveContract } from "src/task_protocols";

/** Responsibilities: _review status_, _review archive_. **/
export class ResolvedReviewArchive implements ResolvedReviewArchiveContract {
	private readonly _review_root: string;
	private readonly _resolved_review_root: string;
	private readonly _file_io: IOContract;

	/** Responsibilities: _review file selection_. **/
	private resolved_review_files(): string[] {
		if (!this._file_io.file(this._review_root).path_exists()) {
			return [];
		}
		const files: string[] = [];
		for (const entry of this._file_io.list_entries(this._review_root)) {
			if (!entry.is_file || !entry.name.endsWith(".md")) {
				continue;
			}
			if ([REVIEW_COMPLETION_FILE, REVIEW_FAILURE_FILE].includes(entry.name)) {
				continue;
			}
			const file = join(this._review_root, entry.name);
			if (this.status(file) === REVIEW_STATUS_RESOLVED) {
				files.push(file);
			}
		}
		return files;
	}

	/** Responsibilities: _review archive movement_. **/
	private archive_file(file: string): void {
		const destination = join(this._resolved_review_root, file.slice(this._review_root.length + 1));
		if (this._file_io.file(destination).path_exists()) {
			this._file_io.file(destination).write_text(this._file_io.file(file).file_text());
			this._file_io.remove_path(file);
			return;
		}
		this._file_io.move_path(file, destination);
	}

	/** Responsibilities: _review archive initialization_. **/
	public constructor(root: string, file_io: IOContract) {
		const project_root = resolve(root);
		const state_root = join(project_root, AI_CODE_GUARD_DIRECTORY);
		this._review_root = join(state_root, REVIEW_DIRECTORY);
		this._resolved_review_root = join(state_root, RESOLVED_REVIEW_DIRECTORY);
		this._file_io = file_io;
	}

	/** Responsibilities: _review state lookup_. **/
	public status(file: string): string {
		const resource = this._file_io.file(file);
		const text = resource.file_text();
		const finding_document = new ReviewFindingDocument(text);
		return finding_document.status();
	}

	/** Responsibilities: _review file archival_. **/
	public archive_resolved_reviews(): void {
		const files = this.resolved_review_files();
		if (files.length === 0) {
			return;
		}
		this._file_io.create_directory(this._resolved_review_root);
		for (const file of files) {
			this.archive_file(file);
		}
	}
}
