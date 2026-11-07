import { isAbsolute, resolve } from "node:path";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { SOURCE_UNAVAILABLE } from "src/core/support/task/constants";
import type { TaskSourceText } from "src/core/support/task/types";
import type { IOContract } from "src/io/protocols";
import type { TaskIssueSourceFileContract } from "src/task_protocols";

/** Responsibilities: _issue source context_, _issue path classification_. **/
export class TaskIssueSourceFile implements TaskIssueSourceFileContract {
	private readonly _root: string;
	private readonly _file: string;
	private readonly _file_io: IOContract;
	private readonly _boundary_failures: SystemFailureClassificationContract;

	/** Responsibilities: _issue source text_. **/
	private source_text(): TaskSourceText {
		try {
			const absolute_file = this.absolute_path();
			if (!this._file_io.path_is_file(absolute_file)) {
				return { available: false, lines: [] };
			}
			return { available: true, lines: this._file_io.file(absolute_file).file_text().split(/\r?\n/u) };
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
			return { available: false, lines: [] };
		}
	}

	/** Responsibilities: _issue source file context_. **/
	public constructor(
		root: string,
		file: string,
		file_io: IOContract,
		boundary_failures: SystemFailureClassificationContract,
	) {
		this._root = root;
		this._file = file;
		this._file_io = file_io;
		this._boundary_failures = boundary_failures;
	}

	/** Responsibilities: _absolute issue path_. **/
	public absolute_path(): string {
		if (isAbsolute(this._file)) {
			return this._file;
		}
		return resolve(this._root, this._file);
	}

	/** Responsibilities: _directory issue classification_. **/
	public directory(): boolean {
		try {
			return this._file_io.path_is_directory(this.absolute_path());
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
			return false;
		}
	}

	/** Responsibilities: _issue source line_. **/
	public source_line(line: number): string {
		if (!Number.isInteger(line)) {
			throw new Error(`Invalid diagnostic line ${line} in ${this._file}.`);
		}
		const source = this.source_text();
		if (!source.available) {
			return SOURCE_UNAVAILABLE;
		}
		const index = line - 1;
		const source_line = source.lines[index];
		if (index < 0 || index >= source.lines.length || source_line === undefined) {
			return "";
		}
		return source_line.trim();
	}
}
