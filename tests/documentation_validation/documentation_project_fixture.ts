import { resolve } from "node:path";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _virtual project paths_, _project source ownership_. **/
export class DocumentationProjectFixture {
	public readonly root: string;
	public readonly source_io: ProjectSourceIOContract;

	/** Responsibilities: _virtual documentation project construction_. **/
	public constructor(root = "/virtual/documentation-validation", files: Record<string, string> = {}) {
		this.root = resolve(root);
		this.source_io = new InMemoryProjectSourceIO(
			new Map(Object.entries(files).map(([path, text]) => [resolve(this.root, path), text])),
		);
	}

	/** Responsibilities: _fixture variants_. **/
	public create(name: string, files: ReadonlyMap<string, string>): DocumentationProjectFixture {
		return new DocumentationProjectFixture(resolve(this.root, name), Object.fromEntries(files));
	}
}
