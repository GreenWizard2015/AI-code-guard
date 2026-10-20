import { join, resolve } from "node:path";
import { IGNORED_DIRS } from "src/constants";
import { CACHE_DIRECTORY_ENTRY_KIND } from "src/core/constants";
import type { LintDirectoryFingerprint } from "src/project_analysis_types";
import type { FileEntryContract, IOContract } from "src/io/protocols";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";

/** Responsibilities: _ignored directory filtering_, _cache directory topology discovery_. **/
export class CacheDirectoryTree {
	private readonly skipped_names: Set<string>;
	private readonly file_io: IOContract;
	private readonly boundary_failures: BoundaryFailureClassifier;

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
			if (!this.boundary_failures.system_failure_message(String(error))) {
				throw error;
			}
		}
	}

	/** Responsibilities: _directory metadata collection_. **/
	private append_fingerprint(directory: string, fingerprints: LintDirectoryFingerprint[]): void {
		try {
			const stats = this.file_io.file_paths.metadata(directory);
			const entries = this.file_io.directory_entries.list_entries(directory).map((entry) => {
				let kind = "other";
				if (entry.is_directory) {
					kind = CACHE_DIRECTORY_ENTRY_KIND;
				} else if (entry.is_file) {
					kind = "file";
				}
				return `${entry.name}\u0000${kind}`;
			});
			entries.sort();
			fingerprints.push({ directory, mtime_ms: stats.mtime_ms, ctime_ms: stats.ctime_ms, entries });
		} catch (error) {
			if (!this.boundary_failures.system_failure_message(String(error))) {
				throw error;
			}
		}
	}

	/** Responsibilities: _directory topology traversal_. **/
	/** Responsibilities: _field initialization_. **/
	constructor(file_io: IOContract) {
		this.skipped_names = IGNORED_DIRS;
		this.file_io = file_io;
		this.boundary_failures = new BoundaryFailureClassifier();
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
