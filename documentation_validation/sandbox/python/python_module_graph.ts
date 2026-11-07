import { PythonModuleGraphTraversal } from "documentation_validation/sandbox/python/python_module_graph_traversal";
import type { DocumentationExampleSourceFile } from "documentation_validation/types";

/** Responsibilities: _Python module ownership_, _reachable source discovery_. **/
export class PythonModuleGraph {
	private readonly _source_files: ReadonlyMap<string, string>;

	/** Responsibilities: _Python module index_. **/
	private python_modules(): Map<string, DocumentationExampleSourceFile> {
		const modules = new Map<string, DocumentationExampleSourceFile>();
		for (const [path, text] of this._source_files) {
			if (path.endsWith(".py")) {
				modules.set(this.module_name(path), { path, text });
			}
		}
		return modules;
	}

	/** Responsibilities: _Python module identity_. **/
	private module_name(path: string): string {
		return path
			.slice(0, -3)
			.replaceAll("/", ".")
			.replace(/\.__init__$/u, "");
	}

	/** Responsibilities: _Python source graph ownership_. **/
	public constructor(source_files: ReadonlyMap<string, string>) {
		this._source_files = source_files;
	}

	/** Responsibilities: _Python module catalog_. **/
	public module_names(): ReadonlySet<string> {
		return new Set(this.python_modules().keys());
	}

	/** Responsibilities: _reachable Python source selection_. **/
	public reachable_sources(test_files: readonly string[], entry: string): DocumentationExampleSourceFile[] {
		const modules = this.python_modules();
		const source_modules = new Set(modules.keys());
		const traversal = new PythonModuleGraphTraversal(modules, source_modules, test_files, entry);
		traversal.walk();
		return traversal.source_files();
	}
}
