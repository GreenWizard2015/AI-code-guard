import type { ImportedFunction } from "src/model/ast/normalized_ast_types";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { TypeScriptImportedFunctionAliasesContract } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _imported function indexing_, _imported name collection_. **/
export class TypeScriptImportedFunctionAliases implements TypeScriptImportedFunctionAliasesContract {
	private readonly _export_resolver: TypeScriptModuleResolverContract;

	/** Responsibilities: _aggregation imported function aliases_. **/
	private append_imported_functions(
		source_file: ts.SourceFile,
		statement: ts.ImportDeclaration,
		imports: Map<string, ImportedFunction>,
	): void {
		const module_specifier = statement.moduleSpecifier;
		if (!ts.isStringLiteral(module_specifier)) {
			return;
		}
		const named = statement.importClause?.namedBindings;
		if (named === undefined) {
			return;
		}
		if (!ts.isNamedImports(named)) {
			return;
		}
		const source_path = this._export_resolver.module_symbol(source_file.fileName, module_specifier.text);
		if (source_path) {
			this.add_imported_functions(named, source_path, imports);
		}
	}

	/** Responsibilities: _resolution storage imported function_. **/
	private add_imported_functions(
		named: ts.NamedImports,
		source_path: string,
		imports: Map<string, ImportedFunction>,
	): void {
		for (const element of named.elements) {
			let source_name = element.name.text;
			if (element.propertyName !== undefined) {
				source_name = element.propertyName.text;
			}
			const resolved = this._export_resolver.resolve({ file: source_path, name: source_name });
			let declaration_file = source_path;
			if (resolved.file.length > 0) {
				declaration_file = resolved.file;
				source_name = resolved.name;
			}
			imports.set(element.name.text, { source_file: declaration_file, source_name });
		}
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
				this.append_imported_functions(source_file, statement, imports);
			}
		}
		return imports;
	}

	/** Responsibilities: _imported function name indexing_. **/
	public imported_function_names(imports: ReadonlyMap<string, ImportedFunction>): ReadonlySet<string> {
		return new Set(imports.keys());
	}
}
