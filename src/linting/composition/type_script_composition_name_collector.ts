import ts from "typescript";

/** Responsibilities: _local class-name collection_, _imported class-name collection_. **/
export class TypeScriptCompositionNameCollector {
	private readonly _source_file: ts.SourceFile;
	private readonly _names: Set<string>;

	/** Responsibilities: _local class name registration_. **/
	private append_local_class(class_statement: ts.Statement): void {
		if (ts.isClassDeclaration(class_statement)) {
			if (class_statement.name !== undefined) {
				this._names.add(class_statement.name.text);
			}
			return;
		}
		if (!ts.isVariableStatement(class_statement)) {
			return;
		}
		for (const declaration of class_statement.declarationList.declarations) {
			if (declaration.initializer && ts.isClassExpression(declaration.initializer)) {
				this._names.add(declaration.name.getText(this._source_file));
			}
		}
	}

	/** Responsibilities: _imported binding name registration_. **/
	private append_imported_bindings(named_imports: ts.NamedImports): void {
		for (const item of named_imports.elements) {
			this._names.add(item.name.text);
		}
	}

	/** Responsibilities: _import clause name registration_. **/
	private append_clause_names(clause: ts.ImportClause): void {
		if (clause.name !== undefined) {
			this._names.add(clause.name.text);
		}
		const bindings = clause.namedBindings;
		if (bindings === undefined) {
			return;
		}
		if (ts.isNamedImports(bindings)) {
			this.append_imported_bindings(bindings);
			return;
		}
		if (ts.isNamespaceImport(bindings)) {
			this._names.add(bindings.name.text);
		}
	}

	/** Responsibilities: _imported class name registration_. **/
	private append_imported_names(import_statement: ts.ImportDeclaration): void {
		const clause = import_statement.importClause;
		if (clause === undefined) {
			return;
		}
		this.append_clause_names(clause);
	}

	/** Responsibilities: _composition-name source initialization_. **/
	public constructor(source_file: ts.SourceFile) {
		this._source_file = source_file;
		this._names = new Set<string>();
	}

	/** Responsibilities: _composition class-name collection_. **/
	public collect(): void {
		for (const statement of this._source_file.statements) {
			this.append_local_class(statement);
			if (ts.isImportDeclaration(statement)) {
				this.append_imported_names(statement);
			}
		}
	}

	/** Responsibilities: _composition class-name index access_. **/
	public class_names(): ReadonlySet<string> {
		return this._names;
	}
}
