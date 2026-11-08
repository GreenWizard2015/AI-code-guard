import type { TypeScriptPropertyModuleResolverContract } from "src/module-resolution/types";
import type { AstNamespaceTypeImportsContract } from "src/source_protocols";
import ts from "typescript";

/** Responsibilities: _namespace module path resolution_, _qualified type key construction_. **/
export class AstNamespaceTypeImports implements AstNamespaceTypeImportsContract {
	private readonly _source: ts.SourceFile;
	private readonly _module_paths: TypeScriptPropertyModuleResolverContract;

	/** Responsibilities: _namespace import module resolution_. **/
	private imported_module(statement: ts.Statement, namespace: string): string {
		if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
			return "";
		}
		const import_clause = statement.importClause;
		if (import_clause === undefined || import_clause.namedBindings === undefined) {
			return "";
		}
		const bindings = import_clause.namedBindings;
		if (!ts.isNamespaceImport(bindings) || bindings.name.text !== namespace) {
			return "";
		}
		return this._module_paths.module_symbol(this._source.fileName, statement.moduleSpecifier.text);
	}

	/** Responsibilities: _initialization namespace type imports_. **/
	public constructor(source: ts.SourceFile, module_paths: TypeScriptPropertyModuleResolverContract) {
		this._source = source;
		this._module_paths = module_paths;
	}

	/** Responsibilities: _namespace module lookup_. **/
	public module(namespace: string): string {
		for (const statement of this._source.statements) {
			const module_file = this.imported_module(statement, namespace);
			if (module_file.length > 0) {
				return module_file;
			}
		}
		return "";
	}

	/** Responsibilities: _qualified namespace type key_. **/
	public key(name: string): string {
		const separator = name.indexOf(".");
		if (separator < 1) {
			return "";
		}
		const module = this.module(name.slice(0, separator));
		if (module.length === 0) {
			return "";
		}
		const resolved = this._module_paths.resolve({ file: module, name: name.slice(separator + 1) });
		if (resolved.file.length === 0) {
			return "";
		}
		return `${resolved.file}\u0000${resolved.name}`;
	}
}
