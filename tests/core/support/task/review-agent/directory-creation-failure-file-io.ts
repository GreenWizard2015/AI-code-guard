import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _directory creation failure_, _failed persistence trace_. **/
export class DirectoryCreationFailureFileIO extends InMemoryFileIO {
	private readonly _attempted_directories: string[];
	private readonly _attempted_moves: string[];

	/** Responsibilities: _directory creation failure setup_. **/
	public constructor() {
		super();
		this._attempted_directories = [];
		this._attempted_moves = [];
	}

	/** Responsibilities: _directory creation failure_. **/
	public override create_directory(directory: string): void {
		this._attempted_directories.push(directory);
	}

	/** Responsibilities: _directory creation evidence_. **/
	public attempted_directories(): readonly string[] {
		return [...this._attempted_directories];
	}

	/** Responsibilities: _failed persistence move trace_. **/
	public override move_path(source: string, destination: string): void {
		this._attempted_moves.push(`${source}:${destination}`);
		super.move_path(source, destination);
	}

	/** Responsibilities: _persistence move evidence_. **/
	public attempted_moves(): readonly string[] {
		return [...this._attempted_moves];
	}
}
