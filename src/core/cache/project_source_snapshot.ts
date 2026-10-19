import type { ProjectSourceContentIOContract, ProjectSourceSnapshotContract } from "src/protocols";
import type { LintInputFiles } from "src/types";

/** Responsibilities: _project source snapshot preparation_, _source text collection_. **/
export class ProjectSourceSnapshot implements ProjectSourceSnapshotContract {
	private readonly source_io: ProjectSourceContentIOContract;

	/** Responsibilities: _snapshot IO ownership_. **/
	public constructor(source_io: ProjectSourceContentIOContract) {
		this.source_io = source_io;
	}

	/** Responsibilities: _unique source path collection_. **/
	public source_paths(inputs: LintInputFiles): readonly string[] {
		const paths = new Set<string>();
		for (const file of inputs.project_files) {
			paths.add(file);
		}
		for (const file of inputs.markdown_files) {
			paths.add(file);
		}
		return [...paths];
	}

	/** Responsibilities: _source text snapshot creation_. **/
	public source_texts(inputs: LintInputFiles): ReadonlyMap<string, string> {
		const texts = new Map<string, string>();
		for (const file of this.source_paths(inputs)) {
			if (!this.source_io.source_available(file)) {
				throw new Error(`Project source is missing from the input snapshot: ${file}`);
			}
			texts.set(file, this.source_io.source_text(file));
		}
		return texts;
	}
}
