import { existsSync, readdirSync, statSync } from "node:fs";
import type { DirectoryEntriesContract, FileEntryContract } from "src/io/protocols";

/** Responsibilities: _path classification_, _directory inventory_. **/
export class NodeDirectoryEntries implements DirectoryEntriesContract {
	/** Responsibilities: _filesystem file detection_. **/
	public path_is_file(path: string): boolean {
		if (!existsSync(path)) {
			return false;
		}
		return statSync(path).isFile();
	}

	/** Responsibilities: _filesystem directory detection_. **/
	public path_is_directory(path: string): boolean {
		if (!existsSync(path)) {
			return false;
		}
		return statSync(path).isDirectory();
	}

	/** Responsibilities: _directory file inventory_. **/
	public list_files(directory: string): readonly string[] {
		return this.list_entries(directory)
			.filter((entry) => entry.is_file)
			.map((entry) => entry.name);
	}

	/** Responsibilities: _filesystem entry classification_. **/
	public list_entries(directory: string): readonly FileEntryContract[] {
		return readdirSync(directory, { withFileTypes: true }).map((entry) => ({
			name: entry.name,
			is_file: entry.isFile(),
			is_directory: entry.isDirectory(),
		}));
	}
}
