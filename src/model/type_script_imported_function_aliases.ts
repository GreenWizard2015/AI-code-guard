import ts from "typescript";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";
import type { ImportedFunction } from "src/types";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import type { TypeScriptImportedFunctionAliasesContract } from "src/protocols";
import type { ProjectSourceIOContract } from "src/protocols";

/** Responsibilities: _imported function indexing_, _imported name collection_. **/
export class TypeScriptImportedFunctionAliases implements TypeScriptImportedFunctionAliasesContract {
	private readonly export_resolver: TypeScriptModuleResolverContract;

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
		const source_path = this.export_resolver.module_symbol(source_file.fileName, module_specifier.text);
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
			const resolved = this.export_resolver.resolve(source_path, source_name);
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
		this.export_resolver = new TypeScriptModuleExports(project_root, source_files, filesystem_fallback, source_io);
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
