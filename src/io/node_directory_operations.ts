import { mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { DirectoryOperationsContract } from "src/io/protocols";

/** Responsibilities: _directory creation_, _filesystem path lifecycle_. **/
export class NodeDirectoryOperations implements DirectoryOperationsContract {
	/** Responsibilities: _directory creation_. **/
	public create_directory(directory: string): void {
		mkdirSync(directory, { recursive: true });
	}

	/** Responsibilities: _exclusive directory creation_. **/
	public create_directory_exclusive(directory: string): void {
		mkdirSync(directory);
	}

	/** Responsibilities: _path movement_. **/
	public move_path(source: string, destination: string): void {
		renameSync(source, destination);
	}

	/** Responsibilities: _temporary directory creation_. **/
	public temporary_directory(parent: string, prefix: string): string {
		return mkdtempSync(join(parent, prefix));
	}

	/** Responsibilities: _recursive path removal_. **/
	public remove_path(path: string): void {
		rmSync(path, { recursive: true, force: true });
	}
}
