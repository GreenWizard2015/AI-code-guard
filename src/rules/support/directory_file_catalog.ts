import { basename, dirname, join } from "node:path";
import { ProjectPathRelation } from "src/core/support/project_path_relation";
import { MODULE_DECLARATION_FILES } from "src/rules/constants";
import { IGNORED_DIRECTORIES } from "src/rules/constants";
import { PYTHON_PACKAGE_MARKER } from "src/constants";
import type { DirectoryFileSet } from "src/types";
import type { FileEntryContract, IOContract } from "src/io/protocols";

/** Responsibilities: _directory file inventory_, _directory nesting inspection_. **/
export class DirectoryFileCatalog {
	private readonly directory_files: DirectoryFileSet;
	private readonly ignored_directories: ReadonlySet<string>;
	private readonly file_io: IOContract;
	public readonly special_file_names: ReadonlySet<string>;

	/** Responsibilities: _virtual file count_. **/
	private virtual_file_count(directory: string): number {
		if (this.virtual_child_files(directory)) {
			return 0;
		}
		return this.directory_files.files
			.filter((file) => dirname(file) === directory)
			.filter((file) => this.countable_file(basename(file))).length;
	}

	/** Responsibilities: _disk file count_. **/
	private disk_file_count(directory: string): number {
		const entries = this.file_io.directory_entries.list_entries(directory);
		if (this.child_entries_present(directory, entries)) {
			return 0;
		}
		return entries.filter((entry) => entry.is_file && this.countable_file(entry.name)).length;
	}

	/** Responsibilities: _nested entry detection_. **/
	private child_entries_present(directory: string, entries: readonly FileEntryContract[]): boolean {
		for (const entry of entries) {
			if (!entry.is_directory || this.ignored_directories.has(entry.name)) {
				continue;
			}
			if (this.file_io.directory_entries.list_entries(join(directory, entry.name)).length > 0) {
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
		return !this.special_file_names.has(name);
	}

	/** Responsibilities: _virtual child file detection_. **/
	private virtual_child_files(directory: string): boolean {
		return this.directory_files.files.some((file) => {
			const relation = new ProjectPathRelation(directory, dirname(file));
			return relation.strictly_nested();
		});
	}

	/** Responsibilities: _file inventory initialization_. **/
	public constructor(directory_files: DirectoryFileSet, file_io: IOContract) {
		this.directory_files = directory_files;
		this.ignored_directories = IGNORED_DIRECTORIES;
		this.file_io = file_io;
		this.special_file_names = new Set(MODULE_DECLARATION_FILES);
	}

	/** Responsibilities: _direct directory file count_. **/
	public direct_file_count(directory: string): number {
		if (this.directory_files.virtual_project) {
			return this.virtual_file_count(directory);
		}
		return this.disk_file_count(directory);
	}

	/** Responsibilities: _nested directory file detection_. **/
	public child_directory_files(directory: string): boolean {
		if (this.directory_files.virtual_project) {
			return this.virtual_child_files(directory);
		}
		const entries = this.file_io.directory_entries.list_entries(directory);
		return entries.some((entry) => {
			if (!entry.is_directory || this.ignored_directories.has(entry.name)) {
				return false;
			}
			return this.file_io.directory_entries.list_entries(join(directory, entry.name)).length > 0;
		});
	}
}
