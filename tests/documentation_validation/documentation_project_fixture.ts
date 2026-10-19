import { resolve } from "node:path";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { DocumentationProject } from "tests/documentation_validation/documentation_project";

/** Responsibilities: _virtual project paths_, _project source ownership_. **/
export class DocumentationProjectFixture {
	/** Responsibilities: _virtual documentation project construction_. **/
	public create(name: string, files: ReadonlyMap<string, string>): DocumentationProject {
		const root = resolve(`/virtual/documentation-validation/${name}`);
		const absolute_entries = new Map<string, string>();
		for (const [file, text] of files) {
			absolute_entries.set(resolve(root, file), text);
		}
		const source_io = new InMemoryProjectSourceIO(absolute_entries);
		return new DocumentationProject(root, source_io);
	}
}
