import { existsSync, readdirSync, statSync } from "node:fs";
import { DIRECTORY_ENTRY_DIRECTORY, DIRECTORY_ENTRY_FILE } from "src/io/constants";
import type { DirectoryEntriesContract, FileEntryContract, FileSystemPathKind } from "src/io/protocols";

/** Responsibilities: _path classification_, _directory inventory_. **/
export class NodeDirectoryEntries implements DirectoryEntriesContract {
	/** Responsibilities: _filesystem path classification_. **/
	public path_kind(path: string): FileSystemPathKind {
		if (!existsSync(path)) {
			return "missing";
		}
		const stats = statSync(path);
		if (stats.isFile()) {
			return DIRECTORY_ENTRY_FILE;
		}
		if (stats.isDirectory()) {
			return DIRECTORY_ENTRY_DIRECTORY;
		}
		return "missing";
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
