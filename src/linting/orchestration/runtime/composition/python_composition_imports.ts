import type { PythonProjectImportContext } from "src/source_types";
import type { AstPythonImport, AstPythonImportName, NormalizedAstFileContract } from "src/types";
import type { ImportedSymbol } from "src/model/types/types";
import type { ProjectSourcePythonContract } from "src/source_protocols";
import { PYTHON_PACKAGE_SUFFIX } from "src/constants";
import { PythonExportIndex } from "src/linting/orchestration/runtime/composition/python_export_index";

/** Responsibilities: _relative import resolution_, _exported symbol resolution_. **/
export class PythonCompositionImports {
	private readonly project_source_python: ProjectSourcePythonContract;
	private readonly project_root: string;
	private readonly files: ReadonlySet<string>;
	private readonly source_asts: ReadonlyMap<string, NormalizedAstFileContract>;
	private readonly export_indexes: WeakMap<NormalizedAstFileContract, PythonExportIndex>;

	/** Responsibilities: _Python package export lookup_. **/
	private indexed_exported_imports(ast: NormalizedAstFileContract, name: string): readonly AstPythonImport[] {
		const imports = ast.python_imports;
		const previous = this.export_indexes.get(ast);
		if (previous !== undefined) {
			if (previous.same_snapshot(imports)) {
				return previous.named(name);
			}
		}
		const index = new PythonExportIndex(imports);
		for (const item of imports) {
			index.index_import(item);
		}
		this.export_indexes.set(ast, index);
		return index.named(name);
	}

	/** Responsibilities: _Python package export statements_. **/
	private exported_imports(ast: NormalizedAstFileContract, name: string): AstPythonImport[] {
		const imports = ast.python_imports;
		if (imports === undefined) {
			return [];
		}
		return [...this.indexed_exported_imports(ast, name)];
	}

	/** Responsibilities: _resolution local exported name_. **/
	private exported_name(item: AstPythonImportName): string {
		const alias = item.alias;
		if (alias.length > 0) {
			return alias;
		}
		return item.name;
	}

	/** Responsibilities: _relative import module mapping_. **/
	private exported_module_path(item: AstPythonImport, imported: AstPythonImportName): string {
		if (/^\.+$/u.test(item.module)) {
			return `${item.module}${imported.name}`;
		}
		return item.module;
	}

	/** Responsibilities: _construction imported symbol record_. **/
	private exported_item_symbol(
		source_file: string,
		item: AstPythonImport,
		name: string,
		resolving: Set<string>,
	): ImportedSymbol {
		for (const imported of item.names) {
			if (this.exported_name(imported) === name) {
				const module_path = this.exported_module_path(item, imported);
				const target = this.project_source_python.python_import_path(
					this.project_root,
					source_file,
					module_path,
					this.files,
				);
				if (target.length === 0) {
					return { file: "", name: "" };
				}
				return this.resolve_exported_state(target, imported.name, resolving);
			}
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _package export lookup_. **/
	private package_exported_symbol(source_file: string, name: string, resolving: Set<string>): ImportedSymbol {
		const ast = this.source_asts.get(source_file);
		if (ast === undefined) {
			return { file: source_file, name };
		}
		const exported = this.exported_imports(ast, name)
			.map((item) => this.exported_item_symbol(source_file, item, name, resolving))
			.find((item) => item.file.length > 0);
		if (exported !== undefined) {
			return exported;
		}
		return { file: source_file, name };
	}

	/** Responsibilities: _recursive exported symbol resolution_. **/
	private resolve_exported_state(source_file: string, name: string, resolving: Set<string>): ImportedSymbol {
		if (!source_file.endsWith(PYTHON_PACKAGE_SUFFIX)) {
			return { file: source_file, name };
		}
		const resolution_key = `${source_file}:${name}`;
		if (resolving.has(resolution_key)) {
			return { file: "", name: "" };
		}
		resolving.add(resolution_key);
		try {
			return this.package_exported_symbol(source_file, name, resolving);
		} finally {
			resolving.delete(resolution_key);
		}
	}

	/** Responsibilities: _initialization Python import resolution_. **/
	public constructor(context: PythonProjectImportContext, source_asts: ReadonlyMap<string, NormalizedAstFileContract>) {
		this.project_root = context.root;
		this.files = context.files;
		this.project_source_python = context.resolver;
		this.source_asts = source_asts;
		this.export_indexes = new WeakMap();
	}

	/** Responsibilities: _recursive exported symbol resolution_. **/
	public resolve_exported_symbol(source_file: string, name: string): ImportedSymbol {
		return this.resolve_exported_state(source_file, name, new Set<string>());
	}

	/** Responsibilities: _resolution Python imports addition_. **/
	public add_python_import(result: Map<string, ImportedSymbol>, file: string, item: AstPythonImport): void {
		const source_file = this.project_source_python.python_import_path(this.project_root, file, item.module, this.files);
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
