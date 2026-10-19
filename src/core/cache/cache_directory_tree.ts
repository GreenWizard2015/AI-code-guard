import { join, resolve } from "node:path";
import { DIRECTORY_ENTRY_DIRECTORY, DIRECTORY_ENTRY_FILE, DIRECTORY_ENTRY_OTHER } from "src/io/constants";
import { IGNORED_DIRS } from "src/constants";
import type { LintDirectoryFingerprint } from "src/types";
import type { FileEntryContract, IOContract } from "src/io/protocols";

/** Responsibilities: _ignored directory filtering_, _cache directory topology discovery_. **/
export class CacheDirectoryTree {
	private readonly skipped_names: Set<string>;
	private readonly file_io: IOContract;

	/** Responsibilities: _child directory filtering_. **/
	private append_directory_entry(directory: string, entry: FileEntryContract, pending: string[]): void {
		if (!entry.is_directory || this.skipped_names.has(entry.name)) {
			return;
		}
		pending.push(join(directory, entry.name));
	}

	/** Responsibilities: _child directory collection_. **/
	private append_children(directory: string, pending: string[]): void {
		try {
			for (const entry of this.file_io.directory_entries.list_entries(directory)) {
				this.append_directory_entry(directory, entry, pending);
			}
		} catch (error) {
			void error;
		}
	}

	/** Responsibilities: _directory metadata collection_. **/
	private append_fingerprint(directory: string, fingerprints: LintDirectoryFingerprint[]): void {
		try {
			const stats = this.file_io.file_paths.metadata(directory);
			const entries = this.file_io.directory_entries.list_entries(directory).map((entry) => {
				let kind = DIRECTORY_ENTRY_OTHER;
				if (entry.is_directory) {
					kind = DIRECTORY_ENTRY_DIRECTORY;
				} else if (entry.is_file) {
					kind = DIRECTORY_ENTRY_FILE;
				}
				return `${entry.name}\u0000${kind}`;
			});
			entries.sort();
			fingerprints.push({ directory, mtime_ms: stats.mtime_ms, ctime_ms: stats.ctime_ms, entries });
		} catch (error) {
			void error;
		}
	}

	/** Responsibilities: _directory topology traversal_. **/
	/** Responsibilities: _field initialization_. **/
	constructor(file_io: IOContract) {
		this.skipped_names = IGNORED_DIRS;
		this.file_io = file_io;
	}
	/** Responsibilities: _public operation_. **/
	public directories(root: string): string[] {
		return [...this.directory_names(root)];
	}

	/** Responsibilities: _directory topology_. **/
	public directory_names(root: string): ReadonlySet<string> {
		const result = new Set<string>();
		const pending = [resolve(root)];
		while (pending.length > 0) {
			const directory = pending.pop();
			if (directory === undefined) {
				continue;
			}
			result.add(directory);
			this.append_children(directory, pending);
		}
		return result;
	}

	/** Responsibilities: _cache directory fingerprints_. **/
	public fingerprints(root: string, files: readonly string[]): LintDirectoryFingerprint[] {
		const directories = new Set(this.directory_names(root));
		for (const file of files) {
			directories.add(resolve(file, ".."));
		}
		const ordered_directories = [...directories];
		ordered_directories.sort();
		const fingerprints: LintDirectoryFingerprint[] = [];
		for (const directory of ordered_directories) {
			this.append_fingerprint(directory, fingerprints);
		}
		return fingerprints;
	}
}
