import { NodeDirectoryEntries } from "src/io/node_directory_entries";
import { NodeDirectoryOperations } from "src/io/node_directory_operations";
import { NodeFileContent } from "src/io/node_file_content";
import { NodeFileOperations } from "src/io/node_file_operations";
import { NodeFilePaths } from "src/io/node_file_paths";
import type {
	DirectoryEntriesContract,
	DirectoryOperationsContract,
	FileContentContract,
	FileOperationsContract,
	FilePathContract,
	IOContract,
} from "src/io/protocols";

/** Responsibilities: _file service wiring_, _directory service wiring_. **/
export class NodeFileIO implements IOContract {
	public readonly file_paths: FilePathContract;
	public readonly file_content: FileContentContract;
	public readonly file_operations: FileOperationsContract;
	public readonly directory_entries: DirectoryEntriesContract;
	public readonly directory_operations: DirectoryOperationsContract;

	/** Responsibilities: _file and directory setup_. **/
	public constructor() {
		this.file_paths = new NodeFilePaths();
		this.file_content = new NodeFileContent();
		this.file_operations = new NodeFileOperations();
		this.directory_entries = new NodeDirectoryEntries();
		this.directory_operations = new NodeDirectoryOperations();
	}
}
