import ts from "typescript";

/** Responsibilities: _import path extraction_, _dynamic specifier recognition_. **/
export class TypeScriptImportSpecifierCollector {
	private readonly _source_file: ts.SourceFile;

	/** Responsibilities: _import declaration specifier extraction_. **/
	private import_declaration_specifier(node: ts.ImportDeclaration): string {
		const specifier = node.moduleSpecifier;
		if (!ts.isStringLiteral(specifier)) {
			return "";
		}
		return specifier.text;
	}

	/** Responsibilities: _export declaration specifier extraction_. **/
	private export_declaration_specifier(node: ts.ExportDeclaration): string {
		const specifier = node.moduleSpecifier;
		if (specifier === undefined || !ts.isStringLiteral(specifier)) {
			return "";
		}
		return specifier.text;
	}

	/** Responsibilities: _import equals specifier extraction_. **/
	private import_equals_specifier(node: ts.ImportEqualsDeclaration): string {
		if (!ts.isExternalModuleReference(node.moduleReference)) {
			return "";
		}
		const specifier = node.moduleReference.expression;
		if (specifier === undefined || !ts.isStringLiteral(specifier)) {
			return "";
		}
		return specifier.text;
	}

	/** Responsibilities: _dynamic import specifier extraction_. **/
	private dynamic_import_specifier(node: ts.CallExpression): string {
		if (node.expression.kind !== ts.SyntaxKind.ImportKeyword) {
			return "";
		}
		for (const argument of node.arguments) {
			if (ts.isStringLiteral(argument)) {
				return argument.text;
			}
			return "";
		}
		return "";
	}

	/** Responsibilities: _recursive import specifier collection_. **/
	private append(imports: string[], node: ts.Node): void {
		const specifier = this.specifier(node);
		if (specifier.length > 0) {
			imports.push(specifier);
		}
		node.forEachChild((child) => this.append(imports, child));
	}

	/** Responsibilities: _collector source initialization_. **/
	public constructor(source_file: ts.SourceFile) {
		this._source_file = source_file;
	}

	/** Responsibilities: _node import specifier extraction_. **/
	public specifier(node: ts.Node): string {
		if (ts.isImportDeclaration(node)) {
			return this.import_declaration_specifier(node);
		}
		if (ts.isExportDeclaration(node)) {
			return this.export_declaration_specifier(node);
		}
		if (ts.isImportEqualsDeclaration(node)) {
			return this.import_equals_specifier(node);
		}
		if (ts.isCallExpression(node)) {
			return this.dynamic_import_specifier(node);
		}
		return "";
	}

	/** Responsibilities: _source import specifier collection_. **/
	public collect(): string[] {
		const imports: string[] = [];
		this.append(imports, this._source_file);
		return imports;
	}
}
