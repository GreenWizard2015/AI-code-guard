import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";

/** Responsibilities: _virtual project paths_, _project source ownership_. **/
export class DocumentationProject {
	public readonly root: string;
	public readonly source_io: InMemoryProjectSourceIO;

	/** Responsibilities: _documentation project state_. **/
	public constructor(root: string, source_io: InMemoryProjectSourceIO) {
		this.root = root;
		this.source_io = source_io;
	}
}
