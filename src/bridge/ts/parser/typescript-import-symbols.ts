import ts from "typescript";
import type { NamedSymbol, NamedSymbolKind } from "src/types";

/** Responsibilities: _classification imported local symbols_. **/
export class TypeScriptImportSymbols {
	private readonly symbol_kind: NamedSymbolKind = "variable";

	/** Responsibilities: _imported symbol name_. **/
	private name(node: ts.Node): string {
		if (ts.isImportSpecifier(node)) {
			return node.name.text;
		}
		if (ts.isNamespaceImport(node)) {
			return node.name.text;
		}
		if (ts.isImportClause(node)) {
			if (node.name !== undefined) {
				return node.name.text;
			}
		}
		return "";
	}

	/** Responsibilities: _import node kind_. **/
	public import_node(node: ts.Node): boolean {
		if (ts.isImportSpecifier(node)) {
			return true;
		}
		if (ts.isNamespaceImport(node)) {
			return true;
		}
		if (ts.isImportClause(node)) {
			return node.name !== undefined;
		}
		return false;
	}

	/** Responsibilities: _leading underscore symbol classification_. **/
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
				kind: this.symbol_kind,
				is_module_constant: false,
				is_module_variable: false,
				visibility: "public",
				is_module_function: false,
			},
		];
	}
}
