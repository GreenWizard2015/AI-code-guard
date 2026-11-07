import { PYTHON_PACKAGE_SUFFIX } from "src/constants";
import type { PythonCompositionImportsContract } from "src/contracts/protocols/lint_runtime_protocols";
import { PythonExportIndex } from "src/linting/composition/python_export_index";
import type { AstPythonImport, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { ImportedSymbol } from "src/model_types";
import type { PythonImportSessionContract } from "src/source_protocols";
import type { PythonProjectImportContext } from "src/source_types";

/** Responsibilities: _relative import resolution_, _exported symbol resolution_. **/
export class PythonCompositionImports implements PythonCompositionImportsContract {
	private readonly _project_source_python: PythonImportSessionContract;
	private readonly _source_asts: ReadonlyMap<string, NormalizedAstFile>;
	private readonly _export_indexes: WeakMap<NormalizedAstFile, PythonExportIndex>;

	/** Responsibilities: _Python package export lookup_. **/
	private indexed_exported_imports(ast: NormalizedAstFile, package_export_name: string): readonly AstPythonImport[] {
		const imports = ast.source.python_imports;
		if (imports === undefined) {
			return [];
		}
		const previous = this._export_indexes.get(ast);
		if (previous !== undefined) {
			if (previous.same_snapshot(imports)) {
				return previous.named(package_export_name);
			}
		}
		const index = new PythonExportIndex(imports);
		for (const item of imports) {
			index.index_import(item);
		}
		this._export_indexes.set(ast, index);
		return index.named(package_export_name);
	}

	/** Responsibilities: _import target resolution_. **/
	private imported_name(import_statement: AstPythonImport, export_name: string): string {
		for (const imported of import_statement.names) {
			let exported_name = imported.name;
			if (imported.alias.length > 0) {
				exported_name = imported.alias;
			}
			if (exported_name === export_name) {
				return imported.name;
			}
		}
		return "";
	}

	/** Responsibilities: _relative import path resolution_. **/
	private import_target(package_file: string, import_statement: AstPythonImport, export_name: string): string {
		let specifier = import_statement.module;
		if (/^\.+$/u.test(specifier)) {
			specifier += this.imported_name(import_statement, export_name);
		}
		return this._project_source_python.resolve_import({
			importer: package_file,
			specifier,
		});
	}

	/** Responsibilities: _package export lookup_. **/
	private package_exported_symbol(
		package_file: string,
		package_export_name: string,
		resolving: Set<string>,
	): ImportedSymbol {
		const ast = this._source_asts.get(package_file);
		if (ast === undefined) {
			return { file: package_file, name: package_export_name };
		}
		for (const import_statement of this.indexed_exported_imports(ast, package_export_name)) {
			const imported_name = this.imported_name(import_statement, package_export_name);
			const target = this.import_target(package_file, import_statement, package_export_name);
			if (target.length === 0) {
				return { file: "", name: "" };
			}
			const exported = this.resolve_exported_state(target, imported_name, resolving);
			if (exported.file.length > 0) {
				return exported;
			}
		}
		return { file: package_file, name: package_export_name };
	}

	/** Responsibilities: _recursive exported symbol resolution_. **/
	private resolve_exported_state(target_file: string, imported_name: string, resolving: Set<string>): ImportedSymbol {
		if (!target_file.endsWith(PYTHON_PACKAGE_SUFFIX)) {
			return { file: target_file, name: imported_name };
		}
		const resolution_key = `${target_file}:${imported_name}`;
		if (resolving.has(resolution_key)) {
			return { file: "", name: "" };
		}
		resolving.add(resolution_key);
		try {
			return this.package_exported_symbol(target_file, imported_name, resolving);
		} finally {
			resolving.delete(resolution_key);
		}
	}

	/** Responsibilities: _initialization Python import resolution_. **/
	public constructor(context: PythonProjectImportContext, source_asts: ReadonlyMap<string, NormalizedAstFile>) {
		this._project_source_python = context.resolver.for_files(context.files);
		this._source_asts = source_asts;
		this._export_indexes = new WeakMap();
	}

	/** Responsibilities: _recursive exported symbol resolution_. **/
	public resolve_exported_symbol(source_file: string, name: string): ImportedSymbol {
		return this.resolve_exported_state(source_file, name, new Set<string>());
	}

	/** Responsibilities: _resolution Python imports addition_. **/
	public add_python_import(result: Map<string, ImportedSymbol>, file: string, item: AstPythonImport): void {
		const source_file = this._project_source_python.resolve_import({ importer: file, specifier: item.module });
		if (source_file.length === 0) {
			return;
		}
		for (const name of item.names) {
			if (name.name !== "*") {
				let imported_name = name.name;
				if (name.alias.length > 0) {
					imported_name = name.alias;
				}
				const exported = this.resolve_exported_state(source_file, name.name, new Set<string>());
				result.set(imported_name, exported);
			}
		}
	}

	/** Responsibilities: _collection resolution Python imports_. **/
	public python_imports(file: string, imports: AstPythonImport[]): Map<string, ImportedSymbol> {
		const result = new Map<string, ImportedSymbol>();
		for (const item of imports) {
			this.add_python_import(result, file, item);
		}
		return result;
	}
}
