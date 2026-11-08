import ts from "typescript";

/** Responsibilities: _caught error text aliases_, _caught error reference matching_. **/
export class TypeScriptCatchErrorAliases {
	private readonly _error_name: string;
	private readonly _statements: ts.NodeArray<ts.Statement>;

	/** Responsibilities: _error text alias classification_. **/
	private error_alias(declaration: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) {
			return false;
		}
		const initializer = declaration.initializer;
		if (!ts.isCallExpression(initializer) || !ts.isIdentifier(initializer.expression)) {
			return false;
		}
		if (initializer.expression.text !== "String") {
			return false;
		}
		return initializer.arguments.some((argument) => ts.isIdentifier(argument) && argument.text === this._error_name);
	}

	/** Responsibilities: _error alias index initialization_. **/
	public constructor(clause: ts.CatchClause) {
		const declaration = clause.variableDeclaration;
		if (declaration !== undefined && ts.isIdentifier(declaration.name)) {
			this._error_name = declaration.name.text;
		} else {
			this._error_name = "";
		}
		this._statements = clause.block.statements;
	}

	/** Responsibilities: _caught error alias lookup_. **/
	public includes(alias_name: string): boolean {
		for (const statement of this._statements) {
			if (!ts.isVariableStatement(statement)) {
				continue;
			}
			for (const declaration of statement.declarationList.declarations) {
				if (!ts.isIdentifier(declaration.name) || declaration.name.text !== alias_name) {
					continue;
				}
				if (this.error_alias(declaration)) {
					return true;
				}
			}
		}
		return false;
	}

	/** Responsibilities: _caught error reference matching_. **/
	public references(reference: ts.Expression): boolean {
		if (ts.isIdentifier(reference)) {
			return reference.text === this._error_name || this.includes(reference.text);
		}
		if (!ts.isCallExpression(reference) || !ts.isIdentifier(reference.expression)) {
			return false;
		}
		if (reference.expression.text !== "String") {
			return false;
		}
		return reference.arguments.some((argument) => ts.isIdentifier(argument) && argument.text === this._error_name);
	}
}
