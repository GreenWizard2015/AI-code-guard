import type { AstReferenceAlias } from "src/model/ast/normalized_ast_types";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import { TypeScriptDefaultBoundaryAliases } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_default_boundary_aliases";
import { TypeScriptNamedBoundaryAliases } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_named_boundary_aliases";
import type { TypeScriptBoundaryAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _import alias collection_, _module identity resolution_. **/
export class TypeScriptBoundaryAliases implements TypeScriptBoundaryAliasesContract {
	private readonly _resolver: TypeScriptModuleResolverContract;
	private readonly _default_aliases: TypeScriptDefaultBoundaryAliases;
	private readonly _named_aliases: TypeScriptNamedBoundaryAliases;

	/** Responsibilities: _import boundary aliases_. **/
	private append_import_aliases(
		aliases: AstReferenceAlias[],
		source_file: ts.SourceFile,
		statement: ts.Statement,
	): void {
		if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
			return;
		}
		const module_path = this._resolver.module_symbol(source_file.fileName, statement.moduleSpecifier.text);
		if (module_path.length === 0 || statement.importClause === undefined) {
			return;
		}
		this._default_aliases.append(aliases, statement.importClause, module_path);
		this._named_aliases.append(aliases, statement.importClause, module_path);
	}

	/** Responsibilities: _boundary alias resolver initialization_. **/
	public constructor(resolver: TypeScriptModuleResolverContract) {
		this._resolver = resolver;
		this._default_aliases = new TypeScriptDefaultBoundaryAliases(resolver);
		this._named_aliases = new TypeScriptNamedBoundaryAliases(resolver);
	}

	/** Responsibilities: _source boundary aliases_. **/
	public collect(source_file: ts.SourceFile, existing: readonly AstReferenceAlias[]): AstReferenceAlias[] {
		const aliases = [...existing];
		for (const statement of source_file.statements) {
			this.append_import_aliases(aliases, source_file, statement);
		}
		return aliases;
	}
}
