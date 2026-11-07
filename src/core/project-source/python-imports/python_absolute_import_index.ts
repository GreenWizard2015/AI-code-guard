import { ProjectPathRelation } from "src/core/support/project_path_relation";
import type { PythonAbsoluteImportIndexContract } from "src/python_types";
import type { AbsoluteImportCandidate } from "src/source_types";

/** Responsibilities: _absolute import indexing_, _source file tracking_. **/
export class PythonAbsoluteImportIndex implements PythonAbsoluteImportIndexContract {
	private readonly _root: string;
	private readonly _files: readonly string[];
	private readonly _processed_files: Set<string>;
	private readonly _candidates: Map<string, AbsoluteImportCandidate>;

	/** Responsibilities: _absolute import candidate indexing_. **/
	private append(file: string): void {
		const relation = new ProjectPathRelation(this._root, file);
		const module_path = relation.path().replaceAll("\\", "/");
		if (module_path.startsWith("../") || this._candidates.has(module_path)) {
			return;
		}
		this._candidates.set(module_path, { file });
	}

	/** Responsibilities: _root import index setup_. **/
	public constructor(root: string, files: readonly string[]) {
		this._root = root;
		this._files = files;
		this._processed_files = new Set();
		this._candidates = new Map();
	}

	/** Responsibilities: _absolute import index access_. **/
	public imports(): ReadonlyMap<string, AbsoluteImportCandidate> {
		if (this._processed_files.size === this._files.length) {
			return this._candidates;
		}
		for (const file of this._files) {
			if (this._processed_files.has(file)) {
				continue;
			}
			this.append(file);
			this._processed_files.add(file);
		}
		return this._candidates;
	}
}
