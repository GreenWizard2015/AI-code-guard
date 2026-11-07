import { isAbsolute, relative, resolve, sep } from "node:path";
import type { TaskViolationPathContract } from "src/reporting_protocols";

/** Responsibilities: _task report path identity_, _directory ancestry_. **/
export class TaskViolationPath implements TaskViolationPathContract {
	private readonly _absolute_path: string;

	/** Responsibilities: _task report path normalization_. **/
	public constructor(root: string, file: string) {
		if (isAbsolute(file)) {
			this._absolute_path = file;
		} else {
			this._absolute_path = resolve(root, file);
		}
	}

	/** Responsibilities: _same-file path comparison_. **/
	public same_file_as(candidate: TaskViolationPathContract): boolean {
		return candidate.matches_absolute_path(this._absolute_path);
	}

	/** Responsibilities: _strict directory descendant classification_. **/
	public descendant_of(directory: TaskViolationPathContract): boolean {
		return directory.contains_descendant_path(this._absolute_path);
	}

	/** Responsibilities: _absolute path identity comparison_. **/
	public matches_absolute_path(candidate: string): boolean {
		return this._absolute_path === candidate;
	}

	/** Responsibilities: _strict descendant path comparison_. **/
	public contains_descendant_path(candidate: string): boolean {
		const path_from_directory = relative(this._absolute_path, candidate);
		if (path_from_directory.length === 0 || path_from_directory === "..") {
			return false;
		}
		if (path_from_directory.startsWith(`..${sep}`) || isAbsolute(path_from_directory)) {
			return false;
		}
		return true;
	}
}
