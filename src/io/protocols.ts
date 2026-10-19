export type FileSystemPathKind = "file" | "directory" | "missing";

/** Responsibilities: _file path lookup_. **/
export interface FilePathContract {
	path_exists(path: string): boolean;
	symbolic_link(path: string): boolean;
	real_path(path: string): string;
	metadata(path: string): FileMetadataContract;
}

/** Responsibilities: _file content access_. **/
export interface FileContentContract {
	file_text(file: string): string;
	write_text(file: string, text: string): void;
	append_text(file: string, text: string): void;
}

/** Responsibilities: _file lifecycle operations_. **/
export interface FileOperationsContract {
	copy_file(source: string, destination: string): void;
	move_file(source: string, destination: string): void;
	remove_file(file: string): void;
}

/** Responsibilities: _file access_. **/
export interface FileContract {
	readonly file_paths: FilePathContract;
	readonly file_content: FileContentContract;
	readonly file_operations: FileOperationsContract;
}

/** Responsibilities: _directory inspection_. **/
export interface DirectoryEntriesContract {
	path_kind(path: string): FileSystemPathKind;
	list_files(directory: string): readonly string[];
	list_entries(directory: string): readonly FileEntryContract[];
}

/** Responsibilities: _directory lifecycle operations_. **/
export interface DirectoryOperationsContract {
	create_directory(directory: string): void;
	create_directory_exclusive(directory: string): void;
	move_path(source: string, destination: string): void;
	temporary_directory(parent: string, prefix: string): string;
	remove_path(path: string): void;
}

/** Responsibilities: _directory access_. **/
export interface DirectoryContract {
	readonly directory_entries: DirectoryEntriesContract;
	readonly directory_operations: DirectoryOperationsContract;
}

/** Responsibilities: _file and directory access_. **/
export interface IOContract extends FileContract, DirectoryContract {}

/** Responsibilities: _directory entry type_. **/
export interface FileEntryContract {
	readonly name: string;
	readonly is_file: boolean;
	readonly is_directory: boolean;
}

/** Responsibilities: _file and directory metadata_. **/
export interface FileMetadataContract {
	readonly size: number;
	readonly mtime_ms: number;
	readonly ctime_ms: number;
}
