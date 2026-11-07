import ts from "typescript";

/** Responsibilities: _declaration name ownership_, _source statement matching_. **/
export class TypeScriptDeclarationMatcher {
	private readonly _declaration_name: string;

	/** Responsibilities: _declaration candidate evaluation_. **/
	public constructor(declaration_name: string) {
		this._declaration_name = declaration_name;
	}

	/** Responsibilities: _source declaration matching_. **/
	public matches_source(source_file: ts.SourceFile): boolean {
		return source_file.statements.some((statement) => this.matches_declaration(statement));
	}

	/** Responsibilities: _single declaration matching_. **/
	public matches_declaration(node: ts.Node): boolean {
		if (ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node)) {
			return node.name?.text === this._declaration_name;
		}
		if (!ts.isVariableStatement(node)) {
			return false;
		}
		return node.declarationList.declarations.some((declaration) => {
			if (!ts.isIdentifier(declaration.name) || declaration.name.text !== this._declaration_name) {
				return false;
			}
			const initializer = declaration.initializer;
			return initializer !== undefined && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer));
		});
	}
}
