import type { ImportedFunction } from "src/model/ast/normalized_ast_types";
import type { ImportedFunctionSource } from "src/model/protocols";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { TypeScriptImportedFunctionAliasesContract } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _imported function indexing_, _imported name collection_. **/
export class TypeScriptImportedFunctionAliases implements TypeScriptImportedFunctionAliasesContract {
	private readonly _export_resolver: TypeScriptModuleResolverContract;

	/** Responsibilities: _aggregation imported function aliases_. **/
	private append_imported_functions(import_source: ImportedFunctionSource): Map<string, ImportedFunction> {
		const clause = import_source.statement.importClause;
		if (clause === undefined || clause.namedBindings === undefined) {
			return new Map();
		}
		const bindings = clause.namedBindings;
		if (!ts.isNamedImports(bindings)) {
			return new Map();
		}
		const source_path = this.import_source(import_source);
		return this.resolved_imports(bindings, source_path);
	}

	/** Responsibilities: _import module resolution_. **/
	private import_source(import_source: ImportedFunctionSource): string {
		const module_specifier = import_source.statement.moduleSpecifier;
		if (!ts.isStringLiteral(module_specifier)) {
			return "";
		}
		return this._export_resolver.module_symbol(import_source.source_file.fileName, module_specifier.text);
	}

	/** Responsibilities: _import alias mapping_. **/
	private resolved_imports(named: ts.NamedImports, source_path: string): Map<string, ImportedFunction> {
		const imports = new Map<string, ImportedFunction>();
		if (source_path.length === 0) {
			return imports;
		}
		for (const element of named.elements) {
			imports.set(element.name.text, this.resolved_import(element, source_path));
		}
		return imports;
	}

	/** Responsibilities: _imported function identity resolution_. **/
	private resolved_import(element: ts.ImportSpecifier, source_path: string): ImportedFunction {
		let source_name = element.name.text;
		if (element.propertyName !== undefined) {
			source_name = element.propertyName.text;
		}
		const resolved = this._export_resolver.resolve({ file: source_path, name: source_name });
		if (resolved.file.length === 0) {
			return { source_file: source_path, source_name };
		}
		return { source_file: resolved.file, source_name: resolved.name };
	}

	/** Responsibilities: _initialization project module resolver_. **/
	public constructor(
		project_root: string,
		source_files: ReadonlyMap<string, ts.SourceFile>,
		filesystem_fallback: boolean,
		source_io: ProjectSourceIOContract,
	) {
		const export_context = new TypeScriptModuleExportsContext(
			project_root,
			source_files,
			filesystem_fallback,
			source_io,
		);
		this._export_resolver = export_context.module_exports();
	}

	/** Responsibilities: _collection imported function aliases_. **/
	public imported_function_aliases(source_file: ts.SourceFile): Map<string, ImportedFunction> {
		const imports = new Map<string, ImportedFunction>();
		for (const statement of source_file.statements) {
			if (ts.isImportDeclaration(statement)) {
				const import_source = { source_file, statement };
				for (const [name, imported] of this.append_imported_functions(import_source)) {
					imports.set(name, imported);
				}
			}
		}
		return imports;
	}

	/** Responsibilities: _imported function name indexing_. **/
	public imported_function_names(imports: ReadonlyMap<string, ImportedFunction>): ReadonlySet<string> {
		return new Set(imports.keys());
	}
}
