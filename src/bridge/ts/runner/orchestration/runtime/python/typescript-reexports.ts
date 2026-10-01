import ts from "typescript";
import { DiagnosticRule } from "src/model/diagnostic-rule";
import type { Violation } from "src/protocols";

/** Responsibilities: _collection TypeScript imported reexports_. **/
export class TypeScriptReexports {
	private readonly rule = new DiagnosticRule("reexports");

	/** Responsibilities: _TypeScript imported clause bindings_. **/
	private append_clause_bindings(bindings: Set<string>, clause: ts.ImportClause): void {
		if (clause.name !== undefined) {
			bindings.add(clause.name.text);
		}
		const named_bindings = clause.namedBindings;
		if (named_bindings === undefined) {
			return;
		}
		if (ts.isNamespaceImport(named_bindings)) {
			bindings.add(named_bindings.name.text);
			return;
		}
		for (const element of named_bindings.elements) {
			bindings.add(element.name.text);
		}
	}

	/** Responsibilities: _binding alias addition_. **/
	private append_declaration_alias(bindings: Set<string>, declaration: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(declaration.name)) {
			return false;
		}
		const initializer = declaration.initializer;
		if (initializer === undefined) {
			return false;
		}
		if (!ts.isIdentifier(initializer)) {
			return false;
		}
		if (!bindings.has(initializer.text) || bindings.has(declaration.name.text)) {
			return false;
		}
		bindings.add(declaration.name.text);
		return true;
	}

	/** Responsibilities: _binding alias collection_. **/
	private append_assignment_alias(bindings: Set<string>, statement: ts.Statement): boolean {
		if (!ts.isVariableStatement(statement)) {
			return false;
		}
		let changed = false;
		for (const declaration of statement.declarationList.declarations) {
			if (this.append_declaration_alias(bindings, declaration)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _import bindings_. **/
	private append_import_bindings(bindings: Set<string>, statement: ts.Statement): void {
		if (!ts.isImportDeclaration(statement)) {
			return;
		}
		const clause = statement.importClause;
		if (clause !== undefined) {
			this.append_clause_bindings(bindings, clause);
		}
	}

	/** Responsibilities: _imported alias bindings_. **/
	private append_alias_bindings(bindings: Set<string>, source_file: ts.SourceFile): void {
		let changed = true;
		while (changed) {
			changed = false;
			for (const statement of source_file.statements) {
				if (this.append_assignment_alias(bindings, statement)) {
					changed = true;
				}
				}
		}
	}

	/** Responsibilities: _collection imported TypeScript bindings_. **/
	private imported_bindings(source_file: ts.SourceFile): Set<string> {
		const bindings = new Set<string>();
		for (const statement of source_file.statements) {
			this.append_import_bindings(bindings, statement);
		}
		this.append_alias_bindings(bindings, source_file);
		return bindings;
	}

	/** Responsibilities: _classification local named reexport_. **/
	private local_reexport(statement: ts.ExportDeclaration, imported_bindings: ReadonlySet<string>): boolean {
		if (statement.moduleSpecifier !== undefined || statement.exportClause === undefined) {
			return false;
		}
		if (!ts.isNamedExports(statement.exportClause)) {
			return false;
		}
		return statement.exportClause.elements.some((element) => {
			let local_name = element.name;
			if (element.propertyName !== undefined) {
				local_name = element.propertyName;
			}
			return imported_bindings.has(local_name.text);
		});
	}

	/** Responsibilities: _classification default imported reexport_. **/
	private default_reexport(statement: ts.ExportAssignment, imported_bindings: ReadonlySet<string>): boolean {
		if (statement.isExportEquals || !ts.isIdentifier(statement.expression)) {
			return false;
		}
		return imported_bindings.has(statement.expression.text);
	}

	/** Responsibilities: _TypeScript reexport violation_. **/
	private reexport_violation(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		statement: ts.Statement,
	): void {
		const line = source_file.getLineAndCharacterOfPosition(statement.getStart(source_file)).line + 1;
		violations.push(
			this.rule.violation(file, line, {
				reason: "use the defining module directly instead of re-exporting it",
			}),
		);
	}

	/** Responsibilities: _TypeScript declaration reexport violation_. **/
	public append_declaration(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		statement: ts.ExportDeclaration,
		imported_bindings: ReadonlySet<string>,
	): void {
		if (statement.moduleSpecifier !== undefined) {
			this.reexport_violation(violations, file, source_file, statement);
			return;
		}
		if (this.local_reexport(statement, imported_bindings)) {
			this.reexport_violation(violations, file, source_file, statement);
		}
	}

	/** Responsibilities: _TypeScript assignment reexport violation_. **/
	public append_assignment(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		statement: ts.ExportAssignment,
		imported_bindings: ReadonlySet<string>,
	): void {
		if (this.default_reexport(statement, imported_bindings)) {
			this.reexport_violation(violations, file, source_file, statement);
		}
	}

	/** Responsibilities: _aggregation TypeScript reexport violations_. **/
	public append(violations: Violation[], file: string, source_file: ts.SourceFile): void {
		const imported_bindings = this.imported_bindings(source_file);
		for (const statement of source_file.statements) {
			if (ts.isExportDeclaration(statement)) {
				this.append_declaration(violations, file, source_file, statement, imported_bindings);
				continue;
			}
			if (ts.isExportAssignment(statement)) {
				this.append_assignment(violations, file, source_file, statement, imported_bindings);
			}
		}
	}
}
