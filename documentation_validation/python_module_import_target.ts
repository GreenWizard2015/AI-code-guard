import { PYTHON_EXAMPLE_SAFE_MODULES } from "documentation_validation/constants";

/** Responsibilities: _Python import target identity_, _source namespace membership_. **/
export class PythonModuleImportTarget {
	private readonly _full_name: string;
	private readonly _root: string;
	private readonly _parent_depth: number;
	private readonly _current_module: string;
	private readonly _source_modules: ReadonlySet<string>;

	/** Responsibilities: _local module namespace_. **/
	private local_namespace(): boolean {
		for (const source_module of this._source_modules) {
			if (source_module.startsWith(`${this._root}.`)) {
				return this._full_name.startsWith(`${this._root}.`);
			}
		}
		for (const source_module of this._source_modules) {
			if (source_module.startsWith(`${this._full_name}.`)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _import target ownership_. **/
	public constructor(full_name: string, current_module: string, source_modules: ReadonlySet<string>) {
		this._full_name = full_name;
		this._root = full_name.split(".", 1).join("");
		this._current_module = current_module;
		this._source_modules = source_modules;
		const relative_name = /^(\.+)/u.exec(full_name);
		let parent_depth = 0;
		if (relative_name !== null) {
			const prefix = relative_name[1];
			if (prefix !== undefined) {
				parent_depth = prefix.length - 1;
			}
		}
		this._parent_depth = parent_depth;
	}

	/** Responsibilities: _full module name_. **/
	public name(): string {
		return this._full_name;
	}

	/** Responsibilities: _module allowlist decision_. **/
	public allowed(): boolean {
		if (this._full_name.startsWith(".")) {
			const current_package = this._current_module.split(".").slice(0, -1);
			return this._parent_depth <= current_package.length;
		}
		if (this._full_name.length === 0 || this._source_modules.has(this._full_name)) {
			return true;
		}
		if (PYTHON_EXAMPLE_SAFE_MODULES.has(this._root)) {
			return this._full_name === this._root;
		}
		return this.local_namespace();
	}
}
