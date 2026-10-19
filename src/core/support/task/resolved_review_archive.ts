import { join, resolve } from "node:path";
import {
	AI_CODE_GUARD_DIRECTORY,
	REVIEW_DIRECTORY,
	REVIEW_FAILURE_FILE,
	REVIEW_COMPLETION_FILE,
	RESOLVED_REVIEW_DIRECTORY,
	REVIEW_STATUS_RESOLVED,
} from "src/core/support/task/review-agent/constants";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _review status_, _review archive_. **/
export class ResolvedReviewArchive {
	private readonly review_root: string;
	private readonly resolved_review_root: string;
	private readonly file_io: IOContract;

	/** Responsibilities: _review file selection_. **/
	private resolved_review_files(): string[] {
		if (!this.file_io.file_paths.path_exists(this.review_root)) {
			return [];
		}
		const files: string[] = [];
		for (const entry of this.file_io.directory_entries.list_entries(this.review_root)) {
			if (!entry.is_file || !entry.name.endsWith(".md")) {
				continue;
			}
			if ([REVIEW_COMPLETION_FILE, REVIEW_FAILURE_FILE].includes(entry.name)) {
				continue;
			}
			const file = join(this.review_root, entry.name);
			if (this.resolved(file)) {
				files.push(file);
			}
		}
		return files;
	}

	/** Responsibilities: _review archive movement_. **/
	private archive_file(file: string): void {
		const destination = join(this.resolved_review_root, file.slice(this.review_root.length + 1));
		if (this.file_io.file_paths.path_exists(destination)) {
			return;
		}
		this.file_io.directory_operations.move_path(file, destination);
	}

	/** Responsibilities: _review archive initialization_. **/
	public constructor(root: string, file_io: IOContract) {
		const project_root = resolve(root);
		const state_root = join(project_root, AI_CODE_GUARD_DIRECTORY);
		this.review_root = join(state_root, REVIEW_DIRECTORY);
		this.resolved_review_root = join(state_root, RESOLVED_REVIEW_DIRECTORY);
		this.file_io = file_io;
	}

	/** Responsibilities: _review state lookup_. **/
	public resolved(file: string): boolean {
		const lines = this.file_io.file_content.file_text(file).split(/\r?\n/u);
		for (const line of lines) {
			if (line.trim() === REVIEW_STATUS_RESOLVED) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _review file archival_. **/
	public archive_resolved_reviews(): void {
		const files = this.resolved_review_files();
		if (files.length === 0) {
			return;
		}
		this.file_io.directory_operations.create_directory(this.resolved_review_root);
		for (const file of files) {
			this.archive_file(file);
		}
	}
}
