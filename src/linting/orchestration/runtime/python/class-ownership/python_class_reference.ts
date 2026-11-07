import type { PythonExportedSymbolResolverContract } from "src/contracts/protocols/composition_protocols";
import type { PythonClassOwnershipStateContract } from "src/linting/orchestration/runtime/python/protocols";
import type { AstPythonImport, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { ImportedSymbol } from "src/model_types";
import type { PythonImportSessionContract } from "src/source_protocols";

/** Responsibilities: _Python class references_, _Python protocol references_. **/
export class PythonClassReference {
	private readonly _ownership: PythonClassOwnershipStateContract;
	private readonly _file: string;
	private readonly _ast: NormalizedAstFile;
	private readonly _base: string;
	private readonly _fallback: ReadonlySet<string>;
	private readonly _import_resolver: PythonImportSessionContract;
	private readonly _export_resolver: PythonExportedSymbolResolverContract;

	/** Responsibilities: _import alias resolution_. **/
	private import_alias(item: AstPythonImport, base: string): string {
		const separator = base.indexOf(".");
		let local_name = base;
		if (separator >= 0) {
			local_name = base.substring(0, separator);
		}
		return this.matching_import_name(item, local_name, base, separator);
	}

	/** Responsibilities: _matching import name_. **/
	private matching_import_name(item: AstPythonImport, local_name: string, base: string, separator: number): string {
		for (const name of item.names) {
			let alias = name.alias;
			if (alias.length === 0) {
				alias = name.name;
			}
			if (alias !== local_name) {
				continue;
			}
			if (separator >= 0) {
				return base.substring(base.lastIndexOf(".") + 1);
			}
			return name.name;
		}
		return "";
	}

	/** Responsibilities: _imported symbol validation_. **/
	private available(binding: ImportedSymbol): boolean {
		if (binding.file.length === 0) {
			return false;
		}
		return binding.name.length > 0;
	}

	/** Responsibilities: _imported class binding_. **/
	private import_binding(): ImportedSymbol {
		for (const item of this._ast.source.python_imports) {
			const imported_file = this._import_resolver.resolve_import({ importer: this._file, specifier: item.module });
			if (imported_file.length === 0) {
				continue;
			}
			const imported_name = this.import_alias(item, this._base);
			if (imported_name.length === 0) {
				continue;
			}
			const exported = this._export_resolver.resolve_exported_symbol(imported_file, imported_name);
			if (exported.file.length > 0 && exported.name.length > 0) {
				return exported;
			}
			return { file: imported_file, name: imported_name };
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _project class binding_. **/
	private project_binding(): ImportedSymbol {
		const local_declarations = this._ownership.declarations(this._file);
		if (local_declarations.class_names.has(this._base)) {
			return { file: this._file, name: this._base };
		}
		const imported = this.import_binding();
		if (!this.available(imported)) {
			return { file: "", name: "" };
		}
		const imported_declarations = this._ownership.declarations(imported.file);
		if (!imported_declarations.class_names.has(imported.name)) {
			return { file: "", name: "" };
		}
		return imported;
	}

	/** Responsibilities: _project protocol binding_. **/
	private project_protocol_binding(): ImportedSymbol {
		const local_declarations = this._ownership.declarations(this._file);
		if (local_declarations.protocol_names.has(this._base)) {
			return { file: this._file, name: this._base };
		}
		const imported = this.import_binding();
		if (!this.available(imported)) {
			return { file: "", name: "" };
		}
		const imported_declarations = this._ownership.declarations(imported.file);
		if (!imported_declarations.protocol_names.has(imported.name)) {
			return { file: "", name: "" };
		}
		return imported;
	}

	/** Responsibilities: _Python class reference initialization_. **/
	public constructor(
		ownership: PythonClassOwnershipStateContract,
		file: string,
		ast: NormalizedAstFile,
		base: string,
		fallback: ReadonlySet<string>,
	) {
		this._ownership = ownership;
		this._file = file;
		this._ast = ast;
		this._base = base;
		this._fallback = fallback;
		this._import_resolver = ownership.import_session();
		this._export_resolver = ownership.exported_symbols();
	}

	/** Responsibilities: _project class recognition_. **/
	public project_class(): boolean {
		if (!this._ownership.project_sources_available()) {
			return this._fallback.has(this._base);
		}
		return this.available(this.project_binding());
	}

	/** Responsibilities: _project protocol recognition_. **/
	public project_protocol(): boolean {
		if (!this._ownership.project_sources_available()) {
			return this._fallback.has(this._base);
		}
		return this.available(this.project_protocol_binding());
	}
}
