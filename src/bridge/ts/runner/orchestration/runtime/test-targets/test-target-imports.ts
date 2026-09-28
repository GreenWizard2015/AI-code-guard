import ts from 'typescript';

/** Responsibilities: _test import collection_. **/
export class TestTargetImports {
	private readonly text: string;

	/** Responsibilities: _declaration import collection_. **/
	private declaration_imports(statement: ts.Statement): string[] {
		if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
			return [];
		}
		return [statement.moduleSpecifier.text];
	}

	/** Responsibilities: _import-equals collection_. **/
	private equals_imports(statement: ts.Statement): string[] {
		if (!ts.isImportEqualsDeclaration(statement) || !ts.isExternalModuleReference(statement.moduleReference)) {
			return [];
		}
		const expression = statement.moduleReference.expression;
		if (expression === undefined || !ts.isStringLiteral(expression)) {
			return [];
		}
		return [expression.text];
	}

	/** Responsibilities: _Python line imports_. **/
	private python_line_imports(line: string): string[] {
		const imports: string[] = [];
		const from_match = /^\s*from\s+([.\w]+)\s+import\s+/.exec(line);
		if (from_match?.[1] !== undefined) {
			imports.push(from_match[1]);
		}
		const import_match = /^\s*import\s+([.\w]+)/.exec(line);
		if (import_match?.[1] !== undefined) {
			imports.push(import_match[1]);
		}
		return imports;
	}

	/** Responsibilities: _initialization import parser_. **/
	public constructor(text: string) {
		this.text = text;
	}

	/** Responsibilities: _TypeScript import collection_. **/
	public typescript(): string[] {
		const source = ts.createSourceFile('test.ts', this.text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
		return source.statements.flatMap(statement => [
			...this.declaration_imports(statement),
			...this.equals_imports(statement),
		]);
	}

	/** Responsibilities: _Python import collection_. **/
	public python(): string[] {
		return this.text.split(/\r?\n/).flatMap(line => this.python_line_imports(line));
	}
}
