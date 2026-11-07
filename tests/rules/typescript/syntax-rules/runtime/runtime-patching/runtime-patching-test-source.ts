import ts from "typescript";

/** Responsibilities: _test source parsing_, _analysis node selection_. **/
export class RuntimePatchingTestSource {
	private readonly _code: string;

	/** Responsibilities: _source text_. **/
	public constructor(code: string) {
		this._code = code;
	}

	/** Responsibilities: _source AST selection_. **/
	public analyzed_node(): ts.Node {
		const source = ts.createSourceFile("patch.ts", this._code, ts.ScriptTarget.Latest, true);
		let candidate: ts.Node = source;
		for (const statement of source.statements) {
			if (ts.isClassDeclaration(statement) || ts.isClassExpression(statement)) {
				return statement;
			}
			if (ts.isExpressionStatement(statement)) {
				candidate = statement.expression;
			}
		}
		return candidate;
	}
}
