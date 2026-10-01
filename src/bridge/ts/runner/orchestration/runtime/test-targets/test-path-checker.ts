import { existsSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { TestPathChecker } from "src/bridge/ts/core/context/protocols";

/** Responsibilities: _checking test filesystem paths_. **/
export class FileSystemTestPathChecker implements TestPathChecker {
	private readonly project_root: string;

	/** Responsibilities: _absolute filesystem path_. **/
	private absolute_path(path: string): string {
		if (isAbsolute(path)) {
			return path;
		}
		return join(this.project_root, path);
	}

	/** Responsibilities: _filesystem path existence_. **/
	private path_exists(path: string): boolean {
		const exists = existsSync(this.absolute_path(path));
		if (!exists) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _initialization filesystem path checker_. **/
	public constructor(project_root: string) {
		this.project_root = project_root;
	}

	/** Responsibilities: _directory path inspection_. **/
	public directory(path: string): boolean {
		if (!this.path_exists(path)) {
			return false;
		}
		return statSync(this.absolute_path(path)).isDirectory();
	}
}
