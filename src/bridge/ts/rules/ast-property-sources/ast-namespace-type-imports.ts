import ts from "typescript";
import type { AstPropertySourcesProtocol } from "src/protocols";

/** Responsibilities: _resolution namespace type imports_. **/
export class AstNamespaceTypeImports {
	private readonly source: ts.SourceFile;
	private readonly sources: AstPropertySourcesProtocol;

	/** Responsibilities: _initialization namespace type imports_. **/
	public constructor(source: ts.SourceFile, sources: AstPropertySourcesProtocol) {
		this.source = source;
		this.sources = sources;
	}

	/** Responsibilities: _namespace module lookup_. **/
	public module(namespace: string): string {
		for (const statement of this.source.statements) {
			if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
				continue;
			}
			const bindings = statement.importClause?.namedBindings;
			if (bindings === undefined || !ts.isNamespaceImport(bindings)) {
				continue;
			}
			if (bindings.name.text === namespace) {
				return this.sources.module_path(this.source.fileName, statement.moduleSpecifier.text);
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
		return `${module}\u0000${name.slice(separator + 1)}`;
	}
}
