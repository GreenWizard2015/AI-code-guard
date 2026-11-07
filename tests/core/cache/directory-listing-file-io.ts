import type { FileEntry } from "src/io/protocols";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _cache directory entries_, _in-memory file storage_. **/
export class DirectoryListingFileIO extends InMemoryFileIO {
	private _listed_directories: string[];

	/** Responsibilities: _directory entry storage_. **/
	public constructor() {
		super();
		this._listed_directories = [];
	}

	/** Responsibilities: _directory entry tracking_. **/
	public override list_entries(directory: string): readonly FileEntry[] {
		this._listed_directories.push(directory);
		return super.list_entries(directory);
	}

	/** Responsibilities: _directory entry snapshot_. **/
	public listed_directories(): readonly string[] {
		return [...this._listed_directories];
	}
}
