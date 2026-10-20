import type { PythonProjectImportContext } from "src/source_types";
import type { AstPythonImport, AstPythonImportName, ImportedFunction } from "src/types";
import type { ProjectSourcePythonContract } from "src/source_protocols";
import type { PythonImportResolutionContract } from "src/python_protocols";

/** Responsibilities: _Python module path resolution_, _imported symbol resolution_. **/
export class PythonImportResolution implements PythonImportResolutionContract {
	private readonly project_source_python: ProjectSourcePythonContract;

	/** Responsibilities: _shared Python import resolver_. **/
	public constructor(context: PythonProjectImportContext) {
		this.project_source_python = context.resolver;
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
			if (root.length !== 0) {
				source_file = this.project_source_python.python_import_path(root, file, item.module, files);
			}
			if (source_file.length === 0) {
				continue;
			}
			this.append_import_names(imports, item.names, source_file);
		}
		return imports;
	}
}
