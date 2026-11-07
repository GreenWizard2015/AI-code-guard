import type { TypeScriptModuleSourceContract, TypeScriptModuleSourceOptions } from "src/module-resolution/protocols";
import ts from "typescript";

/** Responsibilities: _module source availability_, _module source parsing_. **/
export class TypeScriptModuleSource implements TypeScriptModuleSourceContract {
	private readonly _options: TypeScriptModuleSourceOptions;
	/** Responsibilities: _disk-backed module source parsing_. **/
	private disk_source_file(): ts.SourceFile {
		if (!this.available()) {
			return ts.createSourceFile(this._options.file, "", ts.ScriptTarget.Latest, true);
		}
		const loaded = this._options.loaded_source_files.get(this._options.file);
		if (loaded !== undefined) {
			return loaded;
		}
		const source = ts.createSourceFile(
			this._options.file,
			this._options.source_io.source_text(this._options.file),
			ts.ScriptTarget.Latest,
			true,
		);
		this._options.loaded_source_files.set(this._options.file, source);
		return source;
	}

	/** Responsibilities: _module source initialization_. **/
	public constructor(options: TypeScriptModuleSourceOptions) {
		this._options = options;
	}

	/** Responsibilities: _module source availability_. **/
	public available(): boolean {
		if (this._options.shared_source_files.has(this._options.file)) {
			return true;
		}
		if (this._options.runtime_module) {
			if (this._options.source_io.source_available(this._options.file)) {
				return true;
			}
		}
		if (!this._options.filesystem_fallback) {
			return false;
		}
		return this._options.source_io.source_available(this._options.file);
	}

	/** Responsibilities: _module source parsing_. **/
	public source_file(): ts.SourceFile {
		const shared = this._options.shared_source_files.get(this._options.file);
		if (shared !== undefined) {
			return shared;
		}
		return this.disk_source_file();
	}
}
