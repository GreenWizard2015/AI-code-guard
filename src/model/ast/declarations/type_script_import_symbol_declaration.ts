import { MODULE_VARIABLE_KIND } from "src/constants";
import type { AstVisibility, NamedSymbol } from "src/types";
import ts from "typescript";

/** Responsibilities: _import declaration classification_, _import binding symbol extraction_. **/
export class TypeScriptImportSymbolDeclaration {
	private readonly imported_kind: typeof MODULE_VARIABLE_KIND = MODULE_VARIABLE_KIND;
	private readonly imported_visibility: AstVisibility = "public";

	/** Responsibilities: _import binding name resolution_. **/
	private name(node: ts.Node): string {
		if (ts.isImportSpecifier(node)) {
			return node.name.text;
		}
		if (ts.isNamespaceImport(node)) {
			return node.name.text;
		}
		if (!ts.isImportClause(node)) {
			return "";
		}
		if (node.name === undefined) {
			return "";
		}
		return node.name.text;
	}

	/** Responsibilities: _import declaration eligibility_. **/
	public supported(node: ts.Node): boolean {
		if (ts.isImportSpecifier(node) || ts.isNamespaceImport(node)) {
			return true;
		}
		if (!ts.isImportClause(node)) {
			return false;
		}
		return node.name !== undefined;
	}

	/** Responsibilities: _private import symbol construction_. **/
	public symbol(node: ts.Node, source_file: ts.SourceFile): NamedSymbol[] {
		const name = this.name(node);
		if (!name.startsWith("_")) {
			return [];
		}
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line;
		return [
			{
				name,
				line,
				kind: this.imported_kind,
				is_module_constant: false,
				is_module_variable: false,
				visibility: this.imported_visibility,
				is_module_function: false,
			},
		];
	}
}
