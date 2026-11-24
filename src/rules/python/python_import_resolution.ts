import type { AstPythonImport, AstPythonImportName, ImportedFunction } from "src/model/ast/normalized_ast_types";
import type { PythonImportResolutionContract } from "src/python_protocols";
import type { ProjectSourcePythonContract } from "src/source_protocols";
import type { PythonProjectImportContext } from "src/source_types";

/** Responsibilities: _Python module path resolution_, _imported symbol resolution_. **/
export class PythonImportResolution implements PythonImportResolutionContract {
	private readonly _project_source_python: ProjectSourcePythonContract;

	/** Responsibilities: _shared Python import resolver_. **/
	public constructor(context: PythonProjectImportContext) {
		this._project_source_python = context.resolver;
	}

	/** Responsibilities: _aggregation normalization names imported_. **/
	public append_import_names(
		imports: Map<string, ImportedFunction>,
		names: AstPythonImportName[],
		source_file: string,
	): void {
		for (const name of names) {
			let alias = name.name;
			if (name.alias.length > 0) {
				alias = name.alias;
			}
			imports.set(alias, { source_file: source_file, source_name: name.name });
		}
	}

	/** Responsibilities: _collection resolution Python imports_. **/
	public collect_project_imports(
		file: string,
		python_imports: AstPythonImport[],
		root: string,
		files: ReadonlySet<string>,
	): Map<string, ImportedFunction> {
		const imports = new Map<string, ImportedFunction>();
		for (const item of python_imports) {
			let source_file = "";
			if (root.length > 0) {
				source_file = this._project_source_python
					.for_files(files)
					.resolve_import({ importer: file, specifier: item.module });
			}
			if (source_file.length === 0) {
				continue;
			}
			this.append_import_names(imports, item.names, source_file);
		}
		return imports;
	}
}
