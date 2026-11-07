import { MODULE_VARIABLE_KIND } from "src/constants";
import type { AstVisibility, NamedSymbol } from "src/model/ast/normalized_ast_types";
import ts from "typescript";

/** Responsibilities: _import declaration classification_, _import binding symbol extraction_. **/
export class TypeScriptImportSymbolDeclaration {
	private readonly _source_file: ts.SourceFile;
	private readonly _imported_kind: typeof MODULE_VARIABLE_KIND;
	private readonly _imported_visibility: AstVisibility;
	/** Responsibilities: _import binding node identification_. **/
	private import_binding(binding: ts.Node): boolean {
		if (ts.isImportSpecifier(binding)) {
			return true;
		}
		if (ts.isNamespaceImport(binding)) {
			return true;
		}
		return ts.isImportClause(binding);
	}

	/** Responsibilities: _import declaration initialization_. **/
	public constructor(source_file: ts.SourceFile) {
		this._source_file = source_file;
		this._imported_kind = MODULE_VARIABLE_KIND;
		this._imported_visibility = "public";
	}

	/** Responsibilities: _imported binding name resolution_. **/
	public imported_name(specifier: ts.Node): string {
		if (ts.isImportSpecifier(specifier)) {
			return specifier.name.text;
		}
		if (ts.isNamespaceImport(specifier)) {
			return specifier.name.text;
		}
		if (!ts.isImportClause(specifier)) {
			return "";
		}
		if (specifier.name === undefined) {
			return "";
		}
		return specifier.name.text;
	}

	/** Responsibilities: _private import symbol construction_. **/
	public symbol(declaration: ts.Node): NamedSymbol[] {
		if (!this.import_binding(declaration)) {
			return [];
		}
		const declaration_source = this._source_file;
		const name = this.imported_name(declaration);
		if (!name.startsWith("_")) {
			return [];
		}
		const line = declaration_source.getLineAndCharacterOfPosition(declaration.getStart(declaration_source)).line;
		return [
			{
				name,
				line,
				kind: this._imported_kind,
				is_module_constant: false,
				is_module_variable: false,
				visibility: this._imported_visibility,
				is_module_function: false,
			},
		];
	}
}
