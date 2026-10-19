import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _review project location_, _review project files_. **/
export class TaskReviewAgentWorkspace {
	public readonly root: string;
	public readonly io: InMemoryFileIO;

	/** Responsibilities: _review workspace state_. **/
	public constructor(root: string, io: InMemoryFileIO) {
		this.root = root;
		this.io = io;
	}
}
