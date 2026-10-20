import { createHash } from "node:crypto";
import { TypeScriptProjectResolution } from "src/module-resolution/type_script_project_resolution";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _source cache identity_, _project configuration identity_. **/
export class ContextSourceRecordCacheIdentity {
	private readonly repo_root: string;
	private readonly project_files: readonly string[];
	private readonly source_texts: ReadonlyMap<string, string>;
	private readonly source_io: ProjectSourceIOContract;

	/** Responsibilities: _project identity inputs_. **/
	public constructor(
		repo_root: string,
		project_files: readonly string[],
		source_texts: ReadonlyMap<string, string>,
		source_io: ProjectSourceIOContract,
	) {
		this.repo_root = repo_root;
		this.project_files = project_files;
		this.source_texts = source_texts;
		this.source_io = source_io;
	}

	/** Responsibilities: _source hashing_. **/
	public source_identity(): string {
		const hash = createHash("sha256");
		const ordered_files = [...this.project_files];
		ordered_files.sort();
		for (const file of ordered_files) {
			const text = this.source_texts.get(file);
			if (text === undefined) {
				hash.update(`${file}\u0000\u0000`);
				continue;
			}
			hash.update(`${file}\u0000${text}\u0000`);
		}
		return hash.digest("hex");
	}

	/** Responsibilities: _combined cache identity_. **/
	public cache_identity(): string {
		const source_identity = this.source_identity();
		const resolution = new TypeScriptProjectResolution(this.repo_root, this.source_io);
		return `${source_identity}\u0000${resolution.configuration_identity()}`;
	}
}
