import ts from "typescript";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import type { AstReferenceAlias } from "src/types";
import type { TypeScriptBoundaryAliasesContract } from "src/typescript_runtime_protocols";
import { TypeScriptDefaultBoundaryAliases } from "src/linting/orchestration/runtime/typescript-rule-groups/type_script_boundary_aliases/type_script_default_boundary_aliases";
import { TypeScriptNamedBoundaryAliases } from "src/linting/orchestration/runtime/typescript-rule-groups/type_script_boundary_aliases/type_script_named_boundary_aliases";

/** Responsibilities: _import alias collection_, _module identity resolution_. **/
export class TypeScriptBoundaryAliases implements TypeScriptBoundaryAliasesContract {
	private readonly resolver: TypeScriptModuleResolverContract;
	private readonly default_aliases: TypeScriptDefaultBoundaryAliases;
	private readonly named_aliases: TypeScriptNamedBoundaryAliases;

	/** Responsibilities: _import boundary aliases_. **/
	private append_import_aliases(aliases: AstReferenceAlias[], source_file: ts.SourceFile, statement: ts.Statement): void {
		if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
			return;
		}
		const module_path = this.resolver.module_symbol(source_file.fileName, statement.moduleSpecifier.text);
		if (module_path.length === 0 || statement.importClause === undefined) {
			return;
		}
		this.default_aliases.append(aliases, statement.importClause, module_path);
		this.named_aliases.append(aliases, statement.importClause, module_path);
	}

	/** Responsibilities: _boundary alias resolver initialization_. **/
	public constructor(resolver: TypeScriptModuleResolverContract) {
		this.resolver = resolver;
		this.default_aliases = new TypeScriptDefaultBoundaryAliases(resolver);
		this.named_aliases = new TypeScriptNamedBoundaryAliases(resolver);
	}

	/** Responsibilities: _single import boundary aliases_. **/
	public collect_statement(
		existing: readonly AstReferenceAlias[],
		source_file: ts.SourceFile,
		statement: ts.Statement,
	): AstReferenceAlias[] {
		const aliases = [...existing];
		this.append_import_aliases(aliases, source_file, statement);
		return aliases;
	}

	/** Responsibilities: _source boundary aliases_. **/
	public collect(source_file: ts.SourceFile, existing: readonly AstReferenceAlias[]): AstReferenceAlias[] {
		let aliases = [...existing];
		for (const statement of source_file.statements) {
			aliases = this.collect_statement(aliases, source_file, statement);
		}
		return aliases;
	}
}
