import { join, resolve } from "node:path";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import { IGNORED_DIRS } from "src/constants";
import type { CacheDirectorySnapshot } from "src/core/cache/types";
import { CACHE_DIRECTORY_ENTRY_KIND } from "src/core/constants";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import type { FileEntry, IOContract } from "src/io/protocols";
import type { LintDirectoryFingerprint } from "src/project_analysis_types";

/** Responsibilities: _ignored directory filtering_, _cache directory topology discovery_. **/
export class CacheDirectoryTree {
	private readonly _skipped_names: Set<string>;
	private readonly _file_io: IOContract;
	private readonly _boundary_failures: SystemFailureClassificationContract;
	private readonly _root: string;

	/** Responsibilities: _child directory filtering_. **/
	private append_directory_entry(parent_directory: string, entry: FileEntry, pending: string[]): void {
		if (!entry.is_directory || this._skipped_names.has(entry.name)) {
			return;
		}
		pending.push(join(parent_directory, entry.name));
	}

	/** Responsibilities: _child directory collection_. **/
	private append_children(
		directory_to_expand: string,
		pending: string[],
		directory_entries: Map<string, string[]>,
	): void {
		try {
			const entries = this._file_io.list_entries(directory_to_expand);
			directory_entries.set(directory_to_expand, this.fingerprint_entries(entries));
			for (const entry of entries) {
				this.append_directory_entry(directory_to_expand, entry, pending);
			}
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
		}
	}

	/** Responsibilities: _directory child names_. **/
	private child_directories(directory: string): string[] {
		const children: string[] = [];
		try {
			for (const entry of this._file_io.list_entries(directory)) {
				this.append_directory_entry(directory, entry, children);
			}
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
		}
		return children;
	}

	/** Responsibilities: _directory entry snapshot collection_. **/
	private directory_snapshot(): CacheDirectorySnapshot {
		const directories = new Set<string>();
		const entries = new Map<string, string[]>();
		const pending = [this._root];
		while (pending.length > 0) {
			const directory = pending.pop();
			if (directory === undefined) {
				continue;
			}
			directories.add(directory);
			this.append_children(directory, pending, entries);
		}
		return { directories, entries };
	}

	/** Responsibilities: _cache directory entries_. **/
	private fingerprint_entries(source_entries: readonly FileEntry[]): string[] {
		const entries = source_entries.map((entry) => {
			let kind = "other";
			if (entry.is_directory) {
				kind = CACHE_DIRECTORY_ENTRY_KIND;
			} else if (entry.is_file) {
				kind = "file";
			}
			return `${entry.name}\u0000${kind}`;
		});
		entries.sort();
		return entries;
	}

	/** Responsibilities: _directory entry snapshot lookup_. **/
	private directory_entries(directory: string, snapshots: ReadonlyMap<string, string[]>): string[] {
		const cached_entries = snapshots.get(directory);
		if (cached_entries !== undefined) {
			return cached_entries;
		}
		return this.fingerprint_entries(this._file_io.list_entries(directory));
	}

	/** Responsibilities: _directory metadata collection_. **/
	private append_fingerprint(
		directory_to_snapshot: string,
		fingerprints: LintDirectoryFingerprint[],
		directory_entries: ReadonlyMap<string, string[]>,
	): void {
		try {
			const directory_file = this._file_io.file(directory_to_snapshot);
			const stats = directory_file.metadata();
			const entries = this.directory_entries(directory_to_snapshot, directory_entries);
			fingerprints.push({
				directory: directory_to_snapshot,
				mtime_ms: stats.mtime_ms,
				ctime_ms: stats.ctime_ms,
				entries,
			});
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
		}
	}

	/** Responsibilities: _directory fingerprint comparison_. **/
	private directory_fingerprint_matches(fingerprint: LintDirectoryFingerprint): boolean {
		try {
			const entries = this.directory_entries(fingerprint.directory, new Map());
			return JSON.stringify(entries) === JSON.stringify(fingerprint.entries);
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
			return false;
		}
	}

	/** Responsibilities: _directory topology traversal_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor(root: string, file_io: IOContract) {
		this._skipped_names = IGNORED_DIRS;
		this._file_io = file_io;
		this._boundary_failures = new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES);
		this._root = resolve(root);
	}

	/** Responsibilities: _directory topology_. **/
	public directory_names(): ReadonlySet<string> {
		const directories = new Set<string>();
		const pending = [this._root];
		while (pending.length > 0) {
			const directory = pending.pop();
			if (directory === undefined) {
				continue;
			}
			directories.add(directory);
			for (const child of this.child_directories(directory)) {
				pending.push(child);
			}
		}
		return directories;
	}

	/** Responsibilities: _cached directory snapshot comparison_. **/
	public fingerprints_match(expected: readonly LintDirectoryFingerprint[]): boolean {
		const expected_paths = new Set(expected.map((item) => resolve(item.directory)));
		const current_directories = [...this.directory_names()];
		for (const directory of current_directories) {
			if (!expected_paths.has(directory)) {
				return false;
			}
		}
		for (const fingerprint of expected) {
			if (!this.directory_fingerprint_matches(fingerprint)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _cache directory fingerprints_. **/
	public fingerprints(files: readonly string[]): LintDirectoryFingerprint[] {
		const snapshot = this.directory_snapshot();
		const directories = snapshot.directories;
		for (const file of files) {
			directories.add(resolve(file, ".."));
		}
		const ordered_directories = [...directories];
		ordered_directories.sort();
		const fingerprints: LintDirectoryFingerprint[] = [];
		for (const directory of ordered_directories) {
			this.append_fingerprint(directory, fingerprints, snapshot.entries);
		}
		return fingerprints;
	}
}
