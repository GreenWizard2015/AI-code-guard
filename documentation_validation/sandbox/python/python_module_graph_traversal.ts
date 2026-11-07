import { PythonSourceImports } from "documentation_validation/python_source_imports";
import type { DocumentationExampleSourceFile } from "documentation_validation/types";

/** Responsibilities: _Python import traversal state_, _reachable source resolution_. **/
export class PythonModuleGraphTraversal {
	private readonly _modules: ReadonlyMap<string, DocumentationExampleSourceFile>;
	private readonly _source_modules: ReadonlySet<string>;
	private readonly _test_files: readonly string[];
	private readonly _entry: string;
	private readonly _reachable: Set<string>;
	private readonly _pending: string[];

	/** Responsibilities: _Python module identity_. **/
	private module_name(path: string): string {
		return path
			.slice(0, -3)
			.replaceAll("/", ".")
			.replace(/\.__init__$/u, "");
	}

	/** Responsibilities: _seed module selection_. **/
	private initial_modules(): Set<string> {
		const modules = new Set<string>();
		for (const path of [...this._test_files, this._entry]) {
			const module_name = this.module_name(path);
			if (this._modules.has(module_name)) {
				modules.add(module_name);
			}
		}
		return modules;
	}

	/** Responsibilities: _imported module family collection_. **/
	private append_module_family(imported_name: string): void {
		for (const candidate of this._modules.keys()) {
			const related = candidate === imported_name || candidate.startsWith(`${imported_name}.`);
			if (related && !this._reachable.has(candidate)) {
				this._reachable.add(candidate);
				this._pending.push(candidate);
			}
		}
	}

	/** Responsibilities: _reachable import discovery_. **/
	private append_reachable_imports(module_name: string): void {
		const source = this._modules.get(module_name);
		if (source === undefined) {
			return;
		}
		const imports = new PythonSourceImports(source, this._source_modules);
		for (const imported_name of imports.imported_modules()) {
			if (imported_name.length > 0 && !imported_name.startsWith(".")) {
				this.append_module_family(imported_name);
			}
		}
	}

	/** Responsibilities: _import graph initialization_. **/
	public constructor(
		modules: ReadonlyMap<string, DocumentationExampleSourceFile>,
		source_modules: ReadonlySet<string>,
		test_files: readonly string[],
		entry: string,
	) {
		this._modules = modules;
		this._source_modules = source_modules;
		this._test_files = test_files;
		this._entry = entry;
		this._reachable = new Set<string>();
		this._pending = [];
	}

	/** Responsibilities: _transitive import traversal_. **/
	public walk(): void {
		for (const module_name of this.initial_modules()) {
			this._reachable.add(module_name);
			this._pending.push(module_name);
		}
		while (this._pending.length > 0) {
			const module_name = this._pending.pop();
			if (module_name !== undefined) {
				this.append_reachable_imports(module_name);
			}
		}
	}

	/** Responsibilities: _reachable source file access_. **/
	public source_files(): DocumentationExampleSourceFile[] {
		const sources: DocumentationExampleSourceFile[] = [];
		for (const [module_name, source] of this._modules) {
			if (this._reachable.has(module_name)) {
				sources.push(source);
			}
		}
		return sources;
	}
}
