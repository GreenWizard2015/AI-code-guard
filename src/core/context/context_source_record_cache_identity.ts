import { createHash } from "node:crypto";
import { extname } from "node:path";
import { TypeScriptProjectResolution } from "src/module-resolution/project-resolution/type_script_project_resolution";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _source cache identity_, _project configuration identity_. **/
export class ContextSourceRecordCacheIdentity {
	private readonly _repo_root: string;
	private readonly _project_files: readonly string[];
	private readonly _source_texts: ReadonlyMap<string, string>;
	private readonly _source_io: ProjectSourceIOContract;

	/** Responsibilities: _project identity inputs_. **/
	public constructor(
		repo_root: string,
		project_files: readonly string[],
		source_texts: ReadonlyMap<string, string>,
		source_io: ProjectSourceIOContract,
	) {
		this._repo_root = repo_root;
		this._project_files = project_files;
		this._source_texts = source_texts;
		this._source_io = source_io;
	}

	/** Responsibilities: _source hashing_. **/
	public source_identity(): string {
		const hash = createHash("sha256");
		const runtime_extensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".json"]);
		const source_files = [...this._source_texts.keys()];
		const runtime_files = source_files.filter((file) => runtime_extensions.has(extname(file)));
		const ordered_files = [...new Set([...this._project_files, ...runtime_files])];
		ordered_files.sort();
		for (const file of ordered_files) {
			const text = this._source_texts.get(file);
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
		const resolution = new TypeScriptProjectResolution(this._repo_root, this._source_io);
		return `${source_identity}\u0000${resolution.configuration_identity()}`;
	}
}
