import ts from "typescript";
import type { AstReferenceAlias, NamedLine } from "src/types";

/** Responsibilities: _declaration name extraction_, _imported type alias collection_. **/
export class TypeScriptTypeDeclarations {
	private readonly declaration_kinds: Set<ts.SyntaxKind>;

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
		if (node.kind === ts.SyntaxKind.ClassDeclaration || node.kind === ts.SyntaxKind.ClassExpression) {
			if (!ts.isClassLike(node)) {
				return "";
			}
			if (node.name === undefined) {
				return "";
			}
			return node.name.text;
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
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.declaration_kinds = new Set([
			ts.SyntaxKind.InterfaceDeclaration,
			ts.SyntaxKind.TypeAliasDeclaration,
			ts.SyntaxKind.EnumDeclaration,
		]);
	}
	/** Responsibilities: _public operation_. **/
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
