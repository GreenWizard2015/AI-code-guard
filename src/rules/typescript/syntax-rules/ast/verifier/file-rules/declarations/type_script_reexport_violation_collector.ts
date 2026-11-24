import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import ts from "typescript";

/** Responsibilities: _import alias analysis_, _reexport classification_, _diagnostic emission_. **/
export class TypeScriptReexportViolationCollector {
	private readonly _rule: RuleContract;
	private readonly _file: string;
	private readonly _source_file: ts.SourceFile;
	private readonly _imported_bindings: Set<string>;
	private readonly _violations: ViolationContract[];

	/** Responsibilities: _TypeScript imported clause bindings_. **/
	private append_clause_bindings(clause: ts.ImportClause): void {
		if (clause.name !== undefined) {
			this._imported_bindings.add(clause.name.text);
		}
		const named_bindings = clause.namedBindings;
		if (named_bindings === undefined) {
			return;
		}
		if (ts.isNamespaceImport(named_bindings)) {
			this._imported_bindings.add(named_bindings.name.text);
			return;
		}
		for (const element of named_bindings.elements) {
			this._imported_bindings.add(element.name.text);
		}
	}

	/** Responsibilities: _import alias binding_. **/
	private append_declaration_alias(declaration: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(declaration.name)) {
			return false;
		}
		const initializer = declaration.initializer;
		if (initializer === undefined || !ts.isIdentifier(initializer)) {
			return false;
		}
		if (!this._imported_bindings.has(initializer.text) || this._imported_bindings.has(declaration.name.text)) {
			return false;
		}
		this._imported_bindings.add(declaration.name.text);
		return true;
	}

	/** Responsibilities: _variable alias bindings_. **/
	private append_assignment_alias(statement: ts.VariableStatement): boolean {
		let changed = false;
		for (const declaration of statement.declarationList.declarations) {
			if (this.append_declaration_alias(declaration)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _import declaration bindings_. **/
	private append_import_bindings(statement: ts.ImportDeclaration): void {
		const clause = statement.importClause;
		if (clause !== undefined) {
			this.append_clause_bindings(clause);
		}
	}

	/** Responsibilities: _transitive alias bindings_. **/
	private append_alias_bindings(): void {
		let changed = true;
		while (changed) {
			changed = false;
			for (const statement of this._source_file.statements) {
				if (ts.isVariableStatement(statement) && this.append_assignment_alias(statement)) {
					changed = true;
				}
			}
		}
	}

	/** Responsibilities: _classification local named reexport_. **/
	private local_reexport(statement: ts.ExportDeclaration): boolean {
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
			return this._imported_bindings.has(local_name.text);
		});
	}

	/** Responsibilities: _classification default imported reexport_. **/
	private default_reexport(statement: ts.ExportAssignment): boolean {
		if (statement.isExportEquals) {
			return false;
		}
		if (!ts.isIdentifier(statement.expression)) {
			return false;
		}
		return this._imported_bindings.has(statement.expression.text);
	}

	/** Responsibilities: _TypeScript reexport violation_. **/
	private append_violation(statement: ts.Statement): void {
		const line = this._source_file.getLineAndCharacterOfPosition(statement.getStart(this._source_file)).line + 1;
		this._violations.push(
			this._rule.violation(this._file, line, {
				reason: "use the defining module directly instead of re-exporting it",
			}),
		);
	}

	/** Responsibilities: _reexport violation collector initialization_. **/
	public constructor(rule: RuleContract, file: string, source_file: ts.SourceFile, violations: ViolationContract[]) {
		this._rule = rule;
		this._file = file;
		this._source_file = source_file;
		this._imported_bindings = new Set<string>();
		this._violations = violations;
	}

	/** Responsibilities: _import binding index_. **/
	public index_import_bindings(): void {
		for (const statement of this._source_file.statements) {
			if (ts.isImportDeclaration(statement)) {
				this.append_import_bindings(statement);
			}
		}
		this.append_alias_bindings();
	}

	/** Responsibilities: _named export declaration analysis_. **/
	public append_declaration(statement: ts.ExportDeclaration): void {
		if (statement.moduleSpecifier !== undefined || this.local_reexport(statement)) {
			this.append_violation(statement);
		}
	}

	/** Responsibilities: _default export assignment analysis_. **/
	public append_assignment(statement: ts.ExportAssignment): void {
		if (this.default_reexport(statement)) {
			this.append_violation(statement);
		}
	}
}
