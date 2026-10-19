import { resolve } from "node:path";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import type { ProjectSourceIOContract } from "src/protocols";

/** Responsibilities: _virtual documentation project root_, _source snapshot ownership_. **/
export class DocumentationFixture {
	public readonly root: string;
	public readonly source_io: ProjectSourceIOContract;

	/** Responsibilities: _documentation source initialization_. **/
	public constructor(root: string, files: Record<string, string>) {
		this.root = root;
		this.source_io = new InMemoryProjectSourceIO(
			new Map(Object.entries(files).map(([path, text]) => [resolve(root, path), text])),
		);
	}
}
