import { extname, resolve } from "node:path";
import { IGNORED_DIRS } from "src/constants";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _runtime source discovery_, _duplicate path avoidance_. **/
export class ProjectRuntimeSourcePaths {
	private readonly _root: string;
	private readonly _source_io: ProjectSourceIOContract;
	private readonly _extensions: ReadonlySet<string>;

	/** Responsibilities: _runtime source inventory initialization_. **/
	public constructor(root: string, source_io: ProjectSourceIOContract) {
		this._root = resolve(root);
		this._source_io = source_io;
		this._extensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".json"]);
	}

	/** Responsibilities: _runtime source extension filtering_. **/
	public source_paths(): string[] {
		const source_paths = this._source_io.source_paths(this._root, IGNORED_DIRS);
		const runtime_paths: string[] = [];
		for (const path of source_paths) {
			if (this._extensions.has(extname(path))) {
				runtime_paths.push(path);
			}
		}
		return runtime_paths;
	}

	/** Responsibilities: _runtime source path aggregation_, _duplicate path avoidance_. **/
	public append_to(paths: Set<string>, existing_paths: ReadonlySet<string>): void {
		for (const path of this.source_paths()) {
			if (existing_paths.has(path)) {
				continue;
			}
			paths.add(path);
		}
	}
}
