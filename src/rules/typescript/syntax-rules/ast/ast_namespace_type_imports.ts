import ts from "typescript";
import type { TypeScriptPropertyModuleResolverContract } from "src/module-resolution/types";
import type { AstNamespaceTypeImportsContract } from "src/protocols";

/** Responsibilities: _namespace module path resolution_, _qualified type key construction_. **/
export class AstNamespaceTypeImports implements AstNamespaceTypeImportsContract {
	private readonly source: ts.SourceFile;
	private readonly module_paths: TypeScriptPropertyModuleResolverContract;

	/** Responsibilities: _initialization namespace type imports_. **/
	public constructor(source: ts.SourceFile, module_paths: TypeScriptPropertyModuleResolverContract) {
		this.source = source;
		this.module_paths = module_paths;
	}

	/** Responsibilities: _namespace module lookup_. **/
	public module(namespace: string): string {
		for (const statement of this.source.statements) {
			if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
				continue;
			}
			const bindings = statement.importClause?.namedBindings;
			if (bindings === undefined) {
				continue;
			}
			if (!ts.isNamespaceImport(bindings)) {
				continue;
			}
			if (bindings.name.text === namespace) {
				return this.module_paths.module_symbol(this.source.fileName, statement.moduleSpecifier.text);
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
		const resolved = this.module_paths.resolve(module, name.slice(separator + 1));
		if (resolved.file.length === 0) {
			return "";
		}
		return `${resolved.file}\u0000${resolved.name}`;
	}
}
