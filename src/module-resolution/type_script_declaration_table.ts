import ts from "typescript";
import type {
	RecursiveExportResolver,
	ResolvedTypeScriptExport,
} from "src/module-resolution/types";
import type { TypeScriptExportLinksContract } from "src/module-resolution/protocols";
import type { TypeScriptDeclarationIndexContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _direct export resolution_, _default export resolution_. **/
export class TypeScriptDeclarationTable {
	private readonly index: TypeScriptDeclarationIndexContract;
	private readonly links: TypeScriptExportLinksContract;
	private readonly recursive_resolver: RecursiveExportResolver;

	/** Responsibilities: _named declaration export identity_. **/
	private named_declaration(file: string, statement: ts.Statement): ResolvedTypeScriptExport {
		if (ts.isClassDeclaration(statement) || ts.isFunctionDeclaration(statement)) {
			if (statement.name === undefined) {
				return { file, name: "default" };
			}
			return { file, name: statement.name.text };
		}
		const type_name = this.named_type_declaration(statement);
		if (type_name.length > 0) {
			return { file, name: type_name };
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _named type declaration identity_. **/
	private named_type_declaration(statement: ts.Statement): string {
		if (ts.isInterfaceDeclaration(statement)) {
			return statement.name.text;
		}
		if (ts.isTypeAliasDeclaration(statement)) {
			return statement.name.text;
		}
		if (ts.isEnumDeclaration(statement)) {
			return statement.name.text;
		}
		return "";
	}

	/** Responsibilities: _local declaration precedence_. **/
	private local_export(
		file: string,
		name: string,
		source_file: ts.SourceFile,
		visited: Set<string>,
	): ResolvedTypeScriptExport {
		const direct = this.direct_declaration(file, source_file, name, true);
		if (direct.file.length > 0) {
			return direct;
		}
		const default_declaration = this.default_declaration(file, source_file, name);
		if (default_declaration.file.length > 0) {
			return default_declaration;
		}
		return this.export_assignment(file, source_file, name, visited, this.recursive_resolver);
	}

	/** Responsibilities: _forwarded export resolution_. **/
	private forwarded_export(
		file: string,
		name: string,
		source_file: ts.SourceFile,
		visited: Set<string>,
	): ResolvedTypeScriptExport {
		const named = this.links.named_export(file, source_file, name, visited);
		if (named.file.length > 0) {
			return named;
		}
		return this.links.star_export(file, source_file, name, visited);
	}

	/** Responsibilities: _declaration table configuration_. **/
	public constructor(
		index: TypeScriptDeclarationIndexContract,
		links: TypeScriptExportLinksContract,
		recursive_resolver: RecursiveExportResolver,
	) {
		this.index = index;
		this.links = links;
		this.recursive_resolver = recursive_resolver;
	}

	/** Responsibilities: _direct declaration resolution_. **/
	public direct_declaration(
		file: string,
		source_file: ts.SourceFile,
		name: string,
		require_export: boolean,
	): ResolvedTypeScriptExport {
		for (const statement of this.index.declarations_for(source_file, name)) {
			if (require_export) {
				if (!this.index.modifier_present(statement, ts.SyntaxKind.ExportKeyword)) {
					continue;
				}
			}
			return { file, name };
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _default declaration resolution_. **/
	public default_declaration(file: string, source_file: ts.SourceFile, name: string): ResolvedTypeScriptExport {
		if (name !== "default") {
			return { file: "", name: "" };
		}
		for (const statement of this.index.default_declarations(source_file)) {
			const declaration = this.named_declaration(file, statement);
			if (declaration.file.length > 0) {
				return declaration;
			}
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _export assignment resolution_. **/
	public export_assignment(
		file: string,
		source_file: ts.SourceFile,
		name: string,
		visited: Set<string>,
		resolver: RecursiveExportResolver,
	): ResolvedTypeScriptExport {
		if (name !== "default") {
			return { file: "", name: "" };
		}
		for (const statement of this.index.export_assignments(source_file)) {
			if (ts.isIdentifier(statement.expression)) {
				return resolver.local_symbol(file, source_file, statement.expression.text, visited);
			}
			return { file, name: "default" };
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _complete exported symbol selection_. **/
	public exported_symbol(
		file: string,
		name: string,
		source_file: ts.SourceFile,
		visited: Set<string>,
	): ResolvedTypeScriptExport {
		const local = this.local_export(file, name, source_file, visited);
		if (local.file.length > 0) {
			return local;
		}
		return this.forwarded_export(file, name, source_file, visited);
	}
}
