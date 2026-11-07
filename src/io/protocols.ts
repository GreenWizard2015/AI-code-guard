/** Responsibilities: _path-bound file access_, _file resource lifecycle_. **/
export interface FileResourceContract {
	path(): string;
	path_exists(): boolean;
	symbolic_link(): boolean;
	real_path(): string;
	metadata(): FileMetadata;
	file_text(): string;
	write_text(text: string): void;
	append_text(text: string): void;
	copy_to(destination: FileResourceContract): void;
	move_to(destination: FileResourceContract): void;
	remove_file(): void;
}

/** Responsibilities: _directory inspection_. **/
export interface DirectoryEntriesContract {
	path_is_file(path: string): boolean;
	path_is_directory(path: string): boolean;
	list_files(directory: string): readonly string[];
	list_entries(directory: string): readonly FileEntry[];
}

/** Responsibilities: _directory lifecycle operations_. **/
export interface DirectoryOperationsContract {
	create_directory(directory: string): void;
	create_directory_exclusive(directory: string): void;
	move_path(source: string, destination: string): void;
	temporary_directory(parent: string, prefix: string): string;
	remove_path(path: string): void;
}

/** Responsibilities: _file and directory access_. **/
export interface IOContract extends DirectoryEntriesContract, DirectoryOperationsContract {
	file(path: string): FileResourceContract;
}

/** Responsibilities: _directory entry type_. **/
export type FileEntry = {
	readonly name: string;
	readonly is_file: boolean;
	readonly is_directory: boolean;
};

/** Responsibilities: _file and directory metadata_. **/
export type FileMetadata = {
	readonly size: number;
	readonly mtime_ms: number;
	readonly ctime_ms: number;
};
