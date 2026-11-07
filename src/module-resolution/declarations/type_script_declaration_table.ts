import type {
	TypeScriptDeclarationsContract,
	TypeScriptExportLinksContract,
	TypeScriptModuleExportScopeContract,
} from "src/module-resolution/protocols";
import type {
	TypeScriptDeclarationLookup,
	TypeScriptDirectDeclarationQuery,
	TypeScriptExportedSymbolQuery,
	TypeScriptModuleSymbolReference,
} from "src/module-resolution/types";
import type { TypeScriptDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _direct export resolution_, _default export resolution_. **/
export class TypeScriptDeclarationTable implements TypeScriptDeclarationsContract {
	private readonly _index: TypeScriptDeclarationIndexContract;
	private readonly _links: TypeScriptExportLinksContract;
	private readonly _recursive_resolver: TypeScriptModuleExportScopeContract;

	/** Responsibilities: _named declaration export identity_. **/
	private named_declaration(file: string, statement: ts.Statement): TypeScriptModuleSymbolReference {
		if (ts.isClassDeclaration(statement) || ts.isFunctionDeclaration(statement)) {
			if (statement.name === undefined) {
				return { file, name: "default" };
			}
			return { file, name: statement.name.text };
		}
		if (ts.isInterfaceDeclaration(statement)) {
			return { file, name: statement.name.text };
		}
		if (ts.isTypeAliasDeclaration(statement)) {
			return { file, name: statement.name.text };
		}
		if (ts.isEnumDeclaration(statement)) {
			return { file, name: statement.name.text };
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _local export precedence_. **/
	private local_export(lookup: TypeScriptDeclarationLookup, visited: Set<string>): TypeScriptModuleSymbolReference {
		for (const statement of this._index.declarations_for(lookup.source_file, lookup.name)) {
			if (!this._index.modifier_present(statement, ts.SyntaxKind.ExportKeyword)) {
				continue;
			}
			if (lookup.file.length > 0) {
				return { file: lookup.file, name: lookup.name };
			}
			break;
		}
		if (lookup.name !== "default") {
			return { file: "", name: "" };
		}
		return this.default_local_export(lookup, visited);
	}

	/** Responsibilities: _default local export lookup_. **/
	private default_local_export(
		lookup: TypeScriptDeclarationLookup,
		visited: Set<string>,
	): TypeScriptModuleSymbolReference {
		for (const statement of this._index.default_declarations(lookup.source_file)) {
			const declaration = this.named_declaration(lookup.file, statement);
			if (declaration.file.length > 0) {
				return declaration;
			}
		}
		for (const assignment of this._index.export_assignments(lookup.source_file)) {
			if (!ts.isIdentifier(assignment.expression)) {
				return { file: lookup.file, name: "default" };
			}
			const reference = { file: lookup.file, name: assignment.expression.text };
			return this._recursive_resolver.local_symbol({ reference, source_file: lookup.source_file, visited });
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _declaration table configuration_. **/
	public constructor(
		index: TypeScriptDeclarationIndexContract,
		links: TypeScriptExportLinksContract,
		recursive_resolver: TypeScriptModuleExportScopeContract,
	) {
		this._index = index;
		this._links = links;
		this._recursive_resolver = recursive_resolver;
	}

	/** Responsibilities: _direct declaration resolution_. **/
	public direct_declaration(query: TypeScriptDirectDeclarationQuery): TypeScriptModuleSymbolReference {
		const { declaration, require_export } = query;
		for (const statement of this._index.declarations_for(declaration.source_file, declaration.name)) {
			if (require_export) {
				const exported = this._index.modifier_present(statement, ts.SyntaxKind.ExportKeyword);
				if (!exported) {
					continue;
				}
			}
			return { file: declaration.file, name: declaration.name };
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _complete exported symbol selection_. **/
	public exported_symbol(query: TypeScriptExportedSymbolQuery): TypeScriptModuleSymbolReference {
		const { declaration, visited } = query;
		const local = this.local_export(declaration, visited);
		if (local.file.length > 0) {
			return local;
		}
		return this._links.exported_target(declaration.file, declaration.source_file, declaration.name, visited);
	}
}
