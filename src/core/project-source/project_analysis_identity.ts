import { createHash, type Hash } from "node:crypto";
import { resolve } from "node:path";
import type { LintSourceRecord } from "src/source_types";
import {
	PACKAGE_MANIFEST_FILE,
	PYTHON_REQUIREMENTS_FILE,
	MISSING_CACHE_VALUE,
	TYPESCRIPT_CONFIG_FILE,
	IGNORED_DIRS,
	REPORTING_PROJECT_ROOT,
	RULE_DOCUMENT_DIRECTORY,
} from "src/constants";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { FileEntryContract, IOContract } from "src/io/protocols";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";

/** Responsibilities: _project analysis identity_, _cache invalidation boundaries_. **/
export class ProjectAnalysisIdentity implements ProjectAnalysisIdentityContract {
	private readonly algorithm = "sha256";
	private readonly separator = "\u0000";
	private readonly encoding = "hex";
	private readonly analyzer_root: string;
	private readonly analyzer_digests: Map<string, string>;
	private readonly file_io: IOContract;

	/** Responsibilities: _analyzer source file discovery_. **/
	private analyzer_files(directory: string): string[] {
		if (!this.file_io.directory_entries.path_is_directory(directory)) {
			return [];
		}
		const files: string[] = [];
		for (const entry of this.file_io.directory_entries.list_entries(directory)) {
			const path = resolve(directory, entry.name);
			if (entry.is_directory) {
				files.push(...this.analyzer_files(path));
				continue;
			}
			if (entry.is_file) {
				files.push(path);
			}
		}
		return files;
	}

	/** Responsibilities: _included analysis subdirectories_. **/
	private append_analysis_directory(parent: string, entry: FileEntryContract, pending: string[]): void {
		if (!entry.is_directory) {
			return;
		}
		if (IGNORED_DIRS.has(entry.name)) {
			return;
		}
		pending.push(resolve(parent, entry.name));
	}

	/** Responsibilities: _analysis directory children_. **/
	private append_analysis_children(directory: string, pending: string[]): void {
		try {
			for (const entry of this.file_io.directory_entries.list_entries(directory)) {
				this.append_analysis_directory(directory, entry, pending);
			}
		} catch (error) {
			if (!this.system_failure_message(String(error))) {
				throw error;
			}
		}
	}

	/** Responsibilities: _filesystem error classification_. **/
	private system_failure_message(message: string): boolean {
		const message_words = new Set(message.split(/[^A-Z0-9]+/u));
		for (const code of SYSTEM_FAILURE_CODES) {
			if (message_words.has(code)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _analysis directory fingerprint scope_. **/
	private directory_paths(root: string): string[] {
		const directories: string[] = [];
		const pending = [resolve(root)];
		while (pending.length > 0) {
			const directory = pending.pop();
			if (directory === undefined) {
				continue;
			}
			directories.push(directory);
			this.append_analysis_children(directory, pending);
		}
		return directories;
	}

	/** Responsibilities: _analyzer implementation file selection_. **/
	private analyzer_file_paths(): string[] {
		const directories = ["src", RULE_DOCUMENT_DIRECTORY, "test-runner"].map((path) =>
			resolve(this.analyzer_root, path),
		);
		const files = directories.flatMap((directory) => this.analyzer_files(directory));
		const analyzer_paths = [...files, PACKAGE_MANIFEST_FILE, PYTHON_REQUIREMENTS_FILE, TYPESCRIPT_CONFIG_FILE];
		return analyzer_paths.map((path) => resolve(this.analyzer_root, path));
	}

	/** Responsibilities: _analyzer file hashing_. **/
	private append_analyzer_file(hash: Hash, file: string): void {
		hash.update(`${file}${this.separator}`);
		if (!this.file_io.file_paths.path_exists(file)) {
			hash.update(MISSING_CACHE_VALUE);
			return;
		}
		hash.update(this.file_io.file_content.file_text(file));
	}

	/** Responsibilities: _complete analyzer digest construction_. **/
	private create_analyzer_digest(): string {
		const hash = createHash(this.algorithm);
		for (const file of this.analyzer_file_paths()) {
			this.append_analyzer_file(hash, file);
		}
		return hash.digest(this.encoding);
	}

	/** Responsibilities: _field initialization_. **/
	public constructor(file_io: IOContract, analyzer_root = "") {
		this.analyzer_digests = new Map<string, string>();
		this.file_io = file_io;
		let root = analyzer_root;
		if (root.length === 0) {
			root = REPORTING_PROJECT_ROOT;
		}
		this.analyzer_root = resolve(root);
	}

	/** Responsibilities: _source content identity_. **/
	public content(value: string): string {
		return createHash(this.algorithm).update(value).digest(this.encoding);
	}

	/** Responsibilities: _analyzer implementation identity_. **/
	public analyzer(): string {
		const cached_digest = this.analyzer_digests.get(this.analyzer_root);
		if (cached_digest !== undefined) {
			return cached_digest;
		}
		const digest = this.create_analyzer_digest();
		this.analyzer_digests.set(this.analyzer_root, digest);
		return digest;
	}

	/** Responsibilities: _complete project source identity_. **/
	public context(records: readonly LintSourceRecord[]): string {
		const value = `${this.analyzer()}${this.separator}${records
			.map((record) => `${record.absolute_path}${this.separator}${record.text}`)
			.sort()
			.join(this.separator)}`;
		return createHash(this.algorithm).update(value).digest(this.encoding);
	}

	/** Responsibilities: _filesystem-dependent analysis identity_. **/
	public directory_context(root: string): string {
		let value = "";
		for (const directory of this.directory_paths(root).sort()) {
			try {
				const stats = this.file_io.file_paths.metadata(directory);
				value += `${resolve(directory)}${this.separator}${stats.mtime_ms}${this.separator}${stats.ctime_ms}${this.separator}`;
			} catch (error) {
				if (!this.system_failure_message(String(error))) {
					throw error;
				}
			}
		}
		return this.content(value);
	}

	/** Responsibilities: _analysis selection identity_. **/
	public selection(
		files: ReadonlySet<string>,
		ignored_files: ReadonlySet<string>,
		entry_files: ReadonlySet<string>,
	): string {
		const sorted_files = [...files];
		sorted_files.sort();
		const sorted_ignored_files = [...ignored_files];
		sorted_ignored_files.sort();
		const sorted_entry_files = [...entry_files];
		sorted_entry_files.sort();
		const value = JSON.stringify([sorted_files, sorted_ignored_files, sorted_entry_files]);
		return createHash(this.algorithm).update(value).digest(this.encoding);
	}
}
