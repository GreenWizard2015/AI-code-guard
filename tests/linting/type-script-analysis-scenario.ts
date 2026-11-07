import ts from "typescript";

/** Responsibilities: _analysis source setup_, _named binding selection_. **/
export class TypeScriptAnalysisScenario {
	public readonly _source_file: ts.SourceFile;
	public _initializer: ts.Expression;
	public _binding_found: boolean;
	public _count_name: ts.Identifier;
	public _enabled_name: ts.Identifier;
	public _count_binding_found: boolean;
	public _enabled_binding_found: boolean;

	/** Responsibilities: _source file creation_. **/
	public constructor(file: string, source_text: string) {
		this._source_file = ts.createSourceFile(file, source_text, ts.ScriptTarget.Latest, true);
		this._initializer = ts.factory.createIdentifier("missing");
		this._binding_found = false;
		this._count_name = ts.factory.createIdentifier("missing");
		this._enabled_name = ts.factory.createIdentifier("missing");
		this._count_binding_found = false;
		this._enabled_binding_found = false;
	}

	/** Responsibilities: _initializer selection_. **/
	public select_initializer(binding_name: string): void {
		for (const statement of this._source_file.statements) {
			if (!ts.isVariableStatement(statement)) {
				continue;
			}
			for (const declaration of statement.declarationList.declarations) {
				if (!ts.isIdentifier(declaration.name)) {
					continue;
				}
				if (declaration.name.text !== binding_name || declaration.initializer === undefined) {
					continue;
				}
				this._initializer = declaration.initializer;
				this._binding_found = true;
			}
		}
	}

	/** Responsibilities: _named declaration lookup_. **/
	public select_named_declarations(): void {
		for (const statement of this._source_file.statements) {
			if (!ts.isVariableStatement(statement)) {
				continue;
			}
			for (const declaration of statement.declarationList.declarations) {
				if (!ts.isIdentifier(declaration.name)) {
					continue;
				}
				if (declaration.name.text === "count") {
					this._count_name = declaration.name;
					this._count_binding_found = true;
				}
				if (declaration.name.text === "enabled") {
					this._enabled_name = declaration.name;
					this._enabled_binding_found = true;
				}
			}
		}
	}
}
