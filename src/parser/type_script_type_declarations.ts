import type { AstReferenceAlias, NamedLine } from "src/model/ast/normalized_ast_types";
import ts from "typescript";

/** Responsibilities: _declaration name extraction_, _imported type alias collection_. **/
export class TypeScriptTypeDeclarations {
	private readonly _source_file: ts.SourceFile;

	/** Responsibilities: _resolution type alias interface_. **/
	private type_declaration_name(node: ts.Node): string {
		if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
			if (node.name === undefined) {
				return "";
			}
			return node.name.text;
		}
		if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) {
			return node.name.text;
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
	public constructor(source_file: ts.SourceFile) {
		this._source_file = source_file;
	}
	/** Responsibilities: _public operation_. **/
	public declaration_for(node: ts.Node): NamedLine[] {
		const declaration_source = this._source_file;
		const name = this.type_declaration_name(node);
		if (!name) {
			return [];
		}
		return [
			{
				name,
				line: declaration_source.getLineAndCharacterOfPosition(node.getStart(declaration_source)).line,
			},
		];
	}

	/** Responsibilities: _collection imported reference aliases_. **/
	public collect_reference_aliases(): AstReferenceAlias[] {
		const declaration_source = this._source_file;
		const aliases: AstReferenceAlias[] = [];
		for (const statement of declaration_source.statements) {
			aliases.push(...this.statement_reference_aliases(statement));
		}
		return aliases;
	}
}
