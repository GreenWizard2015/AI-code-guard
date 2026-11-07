import { REVIEW_STATUS_RESOLVED } from "src/core/support/task/review-agent/constants";
import type { IOContract } from "src/io/protocols";
import type { ResolvedReviewArchiveContract, TaskReviewFileContract } from "src/task_protocols";

/** Responsibilities: _review file data_, _review file state_. **/
export class TaskReviewFile implements TaskReviewFileContract {
	private readonly _file_path: string;
	private readonly _file_io: IOContract;
	private readonly _archive: ResolvedReviewArchiveContract;

	/** Responsibilities: _review file initialization_. **/
	public constructor(file_path: string, file_io: IOContract, archive: ResolvedReviewArchiveContract) {
		this._file_path = file_path;
		this._file_io = file_io;
		this._archive = archive;
	}

	/** Responsibilities: _file path access_. **/
	public path(): string {
		return this._file_path;
	}

	/** Responsibilities: _file state check_. **/
	public active(): boolean {
		if (!this._file_io.file(this._file_path).path_exists()) {
			return false;
		}
		return this._archive.status(this._file_path) !== REVIEW_STATUS_RESOLVED;
	}

	/** Responsibilities: _line count_. **/
	public line_count(): number {
		return this._file_io.file(this._file_path).file_text().trimEnd().split(/\r?\n/u).length;
	}

	/** Responsibilities: _file text access_. **/
	public text(): string {
		return this._file_io.file(this._file_path).file_text().trim();
	}
}
