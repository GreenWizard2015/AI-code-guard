import { dirname, join } from "node:path";

/** Responsibilities: _relative package directory resolution_, _relative module path resolution_. **/
export class PythonRelativeImportPath {
	private readonly _importer: string;
	private readonly _specifier: string;

	/** Responsibilities: _relative import depth_. **/
	private relative_level(): number {
		let level = 0;
		while (this._specifier[level] === ".") {
			level += 1;
		}
		return level;
	}

	/** Responsibilities: _relative import source initialization_. **/
	public constructor(importer: string, specifier: string) {
		this._importer = importer;
		this._specifier = specifier;
	}

	/** Responsibilities: _relative package directory resolution_. **/
	public package_directory(): string {
		let base = dirname(this._importer);
		for (let index = 1; index < this.relative_level(); index += 1) {
			base = dirname(base);
		}
		return base;
	}

	/** Responsibilities: _relative module path resolution_. **/
	public module_path(): string {
		const base = this.package_directory();
		const module = this._specifier.slice(this.relative_level());
		if (module.length === 0) {
			return base;
		}
		return join(base, ...module.split("."));
	}
}
