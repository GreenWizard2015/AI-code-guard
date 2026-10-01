import ts from "typescript";
import type { AstReferenceAlias, NamedLine } from "src/types";

/** Responsibilities: _extraction TypeScript declaration names_. **/
export class TypeScriptTypeDeclarations {
	private readonly declaration_kinds = new Set([
		ts.SyntaxKind.InterfaceDeclaration,
		ts.SyntaxKind.TypeAliasDeclaration,
		ts.SyntaxKind.EnumDeclaration,
	]);

	/** Responsibilities: _resolution class-like declaration name_. **/
	private class_name(node: ts.Node): string {
		if (ts.isClassDeclaration(node)) {
			if (node.name === undefined) {
				return "";
			}
			return node.name.text;
		}
		if (ts.isClassExpression(node)) {
			if (node.name === undefined) {
				return "";
			}
			return node.name.text;
		}
		return "";
	}

	/** Responsibilities: _resolution named declaration name_. **/
	private declaration_name(node: ts.Node): string {
		if (ts.isInterfaceDeclaration(node)) {
			return node.name.text;
		}
		if (ts.isTypeAliasDeclaration(node)) {
			return node.name.text;
		}
		if (ts.isEnumDeclaration(node)) {
			return node.name.text;
		}
		return "";
	}

	/** Responsibilities: _resolution type alias interface_. **/
	private type_declaration_name(node: ts.Node): string {
		const class_name = this.class_name(node);
		if (class_name.length > 0) {
			return class_name;
		}
		if (this.declaration_kinds.has(node.kind)) {
			return this.declaration_name(node);
		}
		return "";
	}

	/** Responsibilities: _normalization import specifier reference_. **/
	private reference_alias(element: ts.ImportSpecifier): AstReferenceAlias[] {
		if (element.propertyName === undefined) {
			return [];
		}
		return [{ name: element.name.text, target: element.propertyName.text }];
	}

	/** Responsibilities: _collection import declaration aliases_. **/
	private statement_reference_aliases(statement: ts.Statement): AstReferenceAlias[] {
		if (!ts.isImportDeclaration(statement)) {
			return [];
		}
		const bindings = statement.importClause?.namedBindings;
		if (bindings === undefined) {
			return [];
		}
		if (!ts.isNamedImports(bindings)) {
			return [];
		}
		return bindings.elements.flatMap((element) => this.reference_alias(element));
	}

	/** Responsibilities: _extraction normalization declaration lines_. **/
	public declaration_for(node: ts.Node, source_file: ts.SourceFile): NamedLine[] {
		const name = this.type_declaration_name(node);
		if (!name) {
			return [];
		}
		return [
			{
				name,
				line: source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line,
			},
		];
	}

	/** Responsibilities: _collection imported reference aliases_. **/
	public collect_reference_aliases(source_file: ts.SourceFile): AstReferenceAlias[] {
		const aliases: AstReferenceAlias[] = [];
		for (const statement of source_file.statements) {
			aliases.push(...this.statement_reference_aliases(statement));
		}
		return aliases;
	}
}
