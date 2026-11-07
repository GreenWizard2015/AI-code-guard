import ts from "typescript";

/** Responsibilities: _object source inventory_, _destructuring binding setup_. **/
export class ObjectPropertyInventoryScenario {
	public readonly _source_file: ts.SourceFile;

	/** Responsibilities: _object source instrumentation_. **/
	public constructor() {
		this._source_file = ts.createSourceFile(
			"destructuring.ts",
			'const values = { first: "one", second: "two" }; const { first, second } = values;',
			ts.ScriptTarget.Latest,
			true,
		);
	}

	/** Responsibilities: _source declaration collection_. **/
	public declarations(): ts.VariableDeclaration[] {
		const declarations: ts.VariableDeclaration[] = [];
		for (const statement of this._source_file.statements.filter(ts.isVariableStatement)) {
			declarations.push(...statement.declarationList.declarations);
		}
		return declarations;
	}
}
