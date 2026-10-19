import { existsSync, lstatSync, realpathSync, statSync } from "node:fs";
import type { FileMetadataContract, FilePathContract } from "src/io/protocols";

/** Responsibilities: _filesystem path identity_, _file metadata retrieval_. **/
export class NodeFilePaths implements FilePathContract {
	/** Responsibilities: _file existence_. **/
	public path_exists(path: string): boolean {
		return existsSync(path);
	}

	/** Responsibilities: _symbolic link detection_. **/
	public symbolic_link(path: string): boolean {
		const stats = lstatSync(path, { throwIfNoEntry: false });
		if (stats === undefined) {
			return false;
		}
		return stats.isSymbolicLink();
	}

	/** Responsibilities: _canonical existing path resolution_. **/
	public real_path(path: string): string {
		return realpathSync(path);
	}

	/** Responsibilities: _filesystem metadata retrieval_. **/
	public metadata(path: string): FileMetadataContract {
		const stats = statSync(path);
		return { size: stats.size, mtime_ms: stats.mtimeMs, ctime_ms: stats.ctimeMs };
	}
}
