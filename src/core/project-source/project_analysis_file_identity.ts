import type { Hash } from "node:crypto";
import { delimiter, join, resolve } from "node:path";
import {
	IGNORED_DIRS,
	MISSING_CACHE_VALUE,
	PACKAGE_MANIFEST_FILE,
	PYTHON_REQUIREMENTS_FILE,
	RULE_DOCUMENT_DIRECTORY,
	TEST_RUNNER_DIRECTORY,
	TYPESCRIPT_CONFIG_FILE,
} from "src/constants";
import { CACHE_DIRECTORY_ENTRY_KIND } from "src/core/constants";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import type { FileEntry, IOContract } from "src/io/protocols";
import ts from "typescript";

/** Responsibilities: _analysis source inventory_, _runtime identity inputs_. **/
export class ProjectAnalysisFileIdentity {
	private readonly _analyzer_root: string;
	private readonly _file_io: IOContract;
	private readonly _separator: string;
	private readonly _runtime_search_path: string;

	/** Responsibilities: _analyzer source file discovery_. **/
	private analyzer_files(analyzer_directory: string): string[] {
		if (!this._file_io.path_is_directory(analyzer_directory)) {
			return [];
		}
		const files: string[] = [];
		for (const entry of this._file_io.list_entries(analyzer_directory)) {
			this.append_analyzer_file(analyzer_directory, entry, files);
		}
		return files;
	}

	/** Responsibilities: _analyzer source selection_. **/
	private append_analyzer_file(directory: string, entry: FileEntry, files: string[]): void {
		if (entry.is_directory) {
			if (entry.name !== "__pycache__") {
				files.push(...this.analyzer_files(resolve(directory, entry.name)));
			}
			return;
		}
		if (entry.is_file && !entry.name.endsWith(".pyc")) {
			files.push(resolve(directory, entry.name));
		}
	}

	/** Responsibilities: _included analysis subdirectories_. **/
	private append_analysis_directory(parent: string, entry: FileEntry, pending: string[]): void {
		if (!entry.is_directory || IGNORED_DIRS.has(entry.name)) {
			return;
		}
		pending.push(resolve(parent, entry.name));
	}

	/** Responsibilities: _analysis directory children_. **/
	private append_analysis_children(analysis_directory: string, pending: string[]): void {
		try {
			for (const entry of this._file_io.list_entries(analysis_directory)) {
				this.append_analysis_directory(analysis_directory, entry, pending);
			}
		} catch (error) {
			if (!this.system_failure(String(error))) {
				throw error;
			}
		}
	}

	/** Responsibilities: _filesystem failure classification_. **/
	private system_failure(message: string): boolean {
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
		const directories = ["src", RULE_DOCUMENT_DIRECTORY, TEST_RUNNER_DIRECTORY].map((path) =>
			resolve(this._analyzer_root, path),
		);
		const files = directories.flatMap((directory) => this.analyzer_files(directory));
		const analyzer_paths = [...files, PACKAGE_MANIFEST_FILE, PYTHON_REQUIREMENTS_FILE, TYPESCRIPT_CONFIG_FILE];
		return analyzer_paths.map((path) => resolve(this._analyzer_root, path));
	}

	/** Responsibilities: _Python executable identity_. **/
	private python_executable_identity(candidate: string): string {
		if (!this._file_io.path_is_file(candidate)) {
			return "";
		}
		const executable = this._file_io.file(candidate).real_path();
		const metadata = this._file_io.file(executable).metadata();
		return JSON.stringify([ts.version, executable, metadata.size, metadata.mtime_ms, metadata.ctime_ms]);
	}

	/** Responsibilities: _directory Python executable resolution_. **/
	private python_identity(candidates: readonly string[]): string {
		for (const candidate of candidates) {
			const identity = this.python_executable_identity(candidate);
			if (identity.length > 0) {
				return identity;
			}
		}
		return "";
	}

	/** Responsibilities: _Python executable candidates_. **/
	private python_executable_candidates(): string[] {
		const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
		const candidates: string[] = [];
		for (const directory of this._runtime_search_path.split(delimiter)) {
			for (const extension of extensions) {
				candidates.push(join(directory, `python3${extension}`));
			}
		}
		return candidates;
	}

	/** Responsibilities: _parser runtime selection_. **/
	private parser_runtime_identity(): string {
		const identity = this.python_identity(this.python_executable_candidates());
		if (identity.length > 0) {
			return identity;
		}
		return JSON.stringify([ts.version, "python3-unresolved", this._runtime_search_path]);
	}

	/** Responsibilities: _directory entry identity_. **/
	private directory_entry_identity(directory: string): string {
		const entries: string[] = [];
		for (const entry of this._file_io.list_entries(directory)) {
			if (entry.is_directory && IGNORED_DIRS.has(entry.name)) {
				continue;
			}
			let kind = "other";
			if (entry.is_directory) {
				kind = CACHE_DIRECTORY_ENTRY_KIND;
			} else if (entry.is_file) {
				kind = "file";
			}
			entries.push(`${entry.name}${this._separator}${kind}`);
		}
		entries.sort();
		return `${resolve(directory)}${this._separator}${entries.join(this._separator)}${this._separator}`;
	}

	/** Responsibilities: _analysis file inventory initialization_. **/
	public constructor(file_io: IOContract, analyzer_root: string, separator: string, runtime_search_path: string) {
		this._analyzer_root = resolve(analyzer_root);
		this._file_io = file_io;
		this._separator = separator;
		this._runtime_search_path = runtime_search_path;
	}

	/** Responsibilities: _analyzer implementation digest input_. **/
	public append_analyzer_identity(hash: Hash): void {
		hash.update(this.parser_runtime_identity());
		hash.update(this._separator);
		for (const file of this.analyzer_file_paths()) {
			hash.update(`${file}${this._separator}`);
			const resource = this._file_io.file(file);
			if (!resource.path_exists()) {
				hash.update(MISSING_CACHE_VALUE);
				continue;
			}
			hash.update(resource.file_text());
		}
	}

	/** Responsibilities: _directory fingerprint digest input_. **/
	public append_directory_identity(root: string, hash: Hash): void {
		const directories = this.directory_paths(root);
		directories.sort();
		for (const directory of directories) {
			try {
				hash.update(this.directory_entry_identity(directory));
			} catch (error) {
				if (!this.system_failure(String(error))) {
					throw error;
				}
			}
		}
	}
}
