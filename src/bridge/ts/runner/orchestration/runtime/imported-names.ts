import ts from 'typescript';

/** Responsibilities: _collection named imports answer_. **/
export class ImportedNames {
	private readonly source_file: ts.SourceFile;

	/** Responsibilities: _aggregation local names named_. **/
	private append_named_bindings(names: Set<string>, bindings: ts.NamedImports): void {
		for (const element of bindings.elements) {
			names.add(element.name.text);
		}
	}

	/** Responsibilities: _aggregation default namespace named_. **/
	private append_import_clause(names: Set<string>, import_clause: ts.ImportClause): void {
		if (import_clause.name) {
			names.add(import_clause.name.text);
		}
		const bindings = import_clause.namedBindings;
		if (bindings && ts.isNamedImports(bindings)) {
			this.append_named_bindings(names, bindings);
		}
	}

	/** Responsibilities: _initialization source file usage_. **/
	constructor(source_file: ts.SourceFile) {
		this.source_file = source_file;
	}

	/** Responsibilities: _collection local names introduced_. **/
	public collect(): ReadonlySet<string> {
		const names = new Set<string>();
		for (const statement of this.source_file.statements) {
			if (ts.isImportDeclaration(statement) && statement.importClause) {
				this.append_import_clause(names, statement.importClause);
			}
		}
		return names;
	}

	/** Responsibilities: _imported-name reporting_. **/
	public name(name: string): boolean {
		return this.collect().has(name);
	}
}
