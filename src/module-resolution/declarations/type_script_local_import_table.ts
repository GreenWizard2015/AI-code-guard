import type { TypeScriptLocalImportBinding, TypeScriptLocalImportTableContract } from "src/module-resolution/types";
import ts from "typescript";

/** Responsibilities: _local import collection_, _binding lookup by name_. **/
export class TypeScriptLocalImportTable implements TypeScriptLocalImportTableContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _bindings: Map<string, TypeScriptLocalImportBinding[]>;

	/** Responsibilities: _local binding insertion_. **/
	private append(local_name: string, binding: TypeScriptLocalImportBinding): void {
		const existing = this._bindings.get(local_name);
		if (existing === undefined) {
			this._bindings.set(local_name, [binding]);
			return;
		}
		existing.push(binding);
	}

	/** Responsibilities: _named import binding collection_. **/
	private collect_named_bindings(statement: ts.ImportDeclaration, named_bindings: ts.NamedImports): void {
		for (const binding of named_bindings.elements) {
			let imported_name = binding.name.text;
			if (binding.propertyName !== undefined) {
				imported_name = binding.propertyName.text;
			}
			this.append(binding.name.text, { statement, imported_name });
		}
	}

	/** Responsibilities: _import statement collection_. **/
	private collect_statement(statement: ts.Statement): void {
		if (!ts.isImportDeclaration(statement)) {
			return;
		}
		const clause = statement.importClause;
		if (clause === undefined) {
			return;
		}
		if (clause.name !== undefined) {
			this.append(clause.name.text, { statement, imported_name: "default" });
		}
		const named_bindings = clause.namedBindings;
		if (named_bindings !== undefined && ts.isNamedImports(named_bindings)) {
			this.collect_named_bindings(statement, named_bindings);
		}
	}

	/** Responsibilities: _local import table initialization_. **/
	public constructor(source_file: ts.SourceFile) {
		this._source_file = source_file;
		this._bindings = new Map<string, TypeScriptLocalImportBinding[]>();
	}

	/** Responsibilities: _source import collection_. **/
	public collect(): void {
		for (const statement of this._source_file.statements) {
			this.collect_statement(statement);
		}
	}

	/** Responsibilities: _named local binding lookup_. **/
	public bindings_for(name: string): readonly TypeScriptLocalImportBinding[] {
		const bindings = this._bindings.get(name);
		if (bindings === undefined) {
			return [];
		}
		return bindings;
	}
}
