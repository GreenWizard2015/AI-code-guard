import { basename, dirname, join } from "node:path";
import { PYTHON_PACKAGE_MARKER } from "src/constants";
import { ProjectPathRelation } from "src/core/support/project_path_relation";
import type { FileEntry, IOContract } from "src/io/protocols";
import type { DirectoryFileSet } from "src/project_analysis_types";
import { MODULE_DECLARATION_FILES } from "src/rules/constants";
import { IGNORED_DIRECTORIES } from "src/rules/constants";

/** Responsibilities: _directory file inventory_, _directory nesting inspection_. **/
export class DirectoryFileCatalog {
	private readonly _directory_files: DirectoryFileSet;
	private readonly _ignored_directories: ReadonlySet<string>;
	private readonly _file_io: IOContract;
	public readonly _special_file_names: ReadonlySet<string>;

	/** Responsibilities: _virtual file count_. **/
	private virtual_file_count(virtual_directory: string): number {
		if (this.virtual_child_files(virtual_directory)) {
			return 0;
		}
		return this._directory_files.files
			.filter((file) => dirname(file) === virtual_directory)
			.filter((file) => this.countable_file(basename(file))).length;
	}

	/** Responsibilities: _disk file count_. **/
	private disk_file_count(disk_directory: string): number {
		const entries = this._file_io.list_entries(disk_directory);
		if (this.child_entries_present(disk_directory, entries)) {
			return 0;
		}
		return entries.filter((entry) => entry.is_file && this.countable_file(entry.name)).length;
	}

	/** Responsibilities: _nested entry detection_. **/
	private child_entries_present(parent_directory: string, entries: readonly FileEntry[]): boolean {
		for (const entry of entries) {
			if (!entry.is_directory || this._ignored_directories.has(entry.name)) {
				continue;
			}
			if (this._file_io.list_entries(join(parent_directory, entry.name)).length > 0) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _countable file classification_. **/
	private countable_file(name: string): boolean {
		if (name === PYTHON_PACKAGE_MARKER) {
			return false;
		}
		return !this._special_file_names.has(name);
	}

	/** Responsibilities: _virtual child file detection_. **/
	private virtual_child_files(parent_directory: string): boolean {
		return this._directory_files.files.some((file) => {
			const relation = new ProjectPathRelation(parent_directory, dirname(file));
			return relation.strictly_nested();
		});
	}

	/** Responsibilities: _file inventory initialization_. **/
	public constructor(directory_files: DirectoryFileSet, file_io: IOContract) {
		this._directory_files = directory_files;
		this._ignored_directories = IGNORED_DIRECTORIES;
		this._file_io = file_io;
		this._special_file_names = new Set(MODULE_DECLARATION_FILES);
	}

	/** Responsibilities: _direct directory file count_. **/
	public direct_file_count(directory: string): number {
		if (this._directory_files.virtual_project) {
			return this.virtual_file_count(directory);
		}
		return this.disk_file_count(directory);
	}

	/** Responsibilities: _nested directory file detection_. **/
	public child_directory_files(directory: string): boolean {
		if (this._directory_files.virtual_project) {
			return this.virtual_child_files(directory);
		}
		const entries = this._file_io.list_entries(directory);
		return entries.some((entry) => {
			if (!entry.is_directory || this._ignored_directories.has(entry.name)) {
				return false;
			}
			return this._file_io.list_entries(join(directory, entry.name)).length > 0;
		});
	}
}
