import { ReexportNames } from 'src/bridge/ts/runner/orchestration/runtime/python/reexport-names';
import ts from 'typescript';
import type { Violation, Rule } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { LintSourceRecord } from 'src/types';
import type { NormalizedAstFile } from 'src/types';



/** Responsibilities: _detection TypeScript Python facade_. **/
export class Reexports {
	private readonly reexport_rule_id = 'reexports';
	private readonly python_init_file = '/__init__.py';

	/** Responsibilities: _collection imported TypeScript bindings_. **/
	private typescript_imported_bindings(source_file: ts.SourceFile): Set<string> {
		const bindings = new Set<string>();
		for (const statement of source_file.statements) {
			if (!ts.isImportDeclaration(statement) || statement.importClause === undefined) {
				continue;
			}
			this.append_default_binding(bindings, statement.importClause);
			this.append_named_bindings(bindings, statement.importClause);
		}
		return bindings;
	}

	/** Responsibilities: _default import binding collection_. **/
	private append_default_binding(bindings: Set<string>, clause: ts.ImportClause): void {
		if (clause.name !== undefined) {
			bindings.add(clause.name.text);
		}
	}

	/** Responsibilities: _named import binding collection_. **/
	private append_named_bindings(bindings: Set<string>, clause: ts.ImportClause): void {
		if (clause.namedBindings === undefined) {
			return;
		}
		if (ts.isNamespaceImport(clause.namedBindings)) {
			bindings.add(clause.namedBindings.name.text);
			return;
		}
		for (const element of clause.namedBindings.elements) {
			bindings.add(element.name.text);
		}
	}

	/** Responsibilities: _classification local TypeScript reexport_. **/
	private local_typescript_reexport(
		statement: ts.ExportDeclaration,
		imported_bindings: ReadonlySet<string>,
	): boolean {
		const export_clause = statement.exportClause;
		if (statement.moduleSpecifier !== undefined) {
			return false;
		}
		if (export_clause === undefined) {
			return false;
		}
		if (!ts.isNamedExports(export_clause)) {
			return false;
		}
		return export_clause.elements.some(element => {
			let local_name = element.name;
			if (element.propertyName !== undefined) {
				local_name = element.propertyName;
			}
			return imported_bindings.has(local_name.text);
		});
	}

	/** Responsibilities: _aggregation TypeScript reexport violations_. **/
	private append_typescript_reexports(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile
	): void {
		const rule = this.reexport_rule();
		const imported_bindings = this.typescript_imported_bindings(source_file);
		for (const statement of source_file.statements) {
			if (!ts.isExportDeclaration(statement)) {
				continue;
			}
			if (statement.moduleSpecifier === undefined && !this.local_typescript_reexport(statement, imported_bindings)) {
				continue;
			}
			const line = source_file.getLineAndCharacterOfPosition(statement.getStart(source_file)).line;
			violations.push(
				rule.violation(file, line + 1, {
					reason: 'use the defining module directly instead of re-exporting it',
				})
			);
		}
	}

	/** Responsibilities: _inspection Python import facade_. **/
	private append_python_reexport(
		violations: Violation[],
		file: string,
		text: string,
		ast: NormalizedAstFile
	): void {
		if (file.endsWith(this.python_init_file)) {
			return;
		}
		const first_import_line = this.python_facade_line(text, ast);
		if (first_import_line < 0) {
			return;
		}
		this.append_python_violation(violations, file, first_import_line);
	}

	/** Responsibilities: _aggregation Python facade reexport_. **/
	private append_python_violation(violations: Violation[], file: string, line: number): void {
		const rule = this.reexport_rule();
		violations.push(
			rule.violation(file, line + 1, {
				reason: 'use the defining module directly instead of a re-export facade',
			})
		);
	}

	/** Responsibilities: _classification diagnostic line Python_. **/
	private python_facade_line(text: string, ast: NormalizedAstFile): number {
		const lines = text.split('\n');
		if (!this.is_python_facade(lines, ast)) {
			return -1;
		}
		const imports = ast.python_imports;
		if (imports === undefined || imports.length === 0) {
			return -1;
		}
		const import_node = imports[0];
		return import_node.line;
	}

	/** Responsibilities: _classification Python source facade_. **/
	private is_python_facade(lines: string[], ast: NormalizedAstFile): boolean {
		const reexport_names = new ReexportNames();

		if (!ast.python_imports?.length) {
			return false;
		}
		if (ast.functions.length > 0 || ast.classes.length > 0) {
			return false;
		}
		return this.facade_lines(lines, reexport_names);
	}

	/** Responsibilities: _facade line structure_. **/
	private facade_lines(lines: string[], reexport_names: ReexportNames): boolean {
		let import_parentheses = 0;
		for (const line of lines) {
			const trimmed = line.trim();
			const next_parentheses = this.next_parentheses(trimmed, import_parentheses);
			if (next_parentheses >= 0) {
				import_parentheses = next_parentheses;
				continue;
			}
			if (reexport_names.implementation_line(line)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _Python facade import state_. **/
	private next_parentheses(line: string, current: number): number {
		if (current > 0) {
			return current + this.parenthesis_delta(line);
		}
		return this.import_delta(line);
	}

	/** Responsibilities: _Python import parenthesis tracking_. **/
	private import_delta(line: string): number {
		if (line.startsWith('from ')) {
			return this.parenthesis_delta(line);
		}
		if (line.startsWith('import ')) {
			return this.parenthesis_delta(line);
		}
		return -1;
	}

	/** Responsibilities: _count multiline import parentheses_. **/
	private parenthesis_delta(line: string): number {
		let opening = 0;
		let closing = 0;
		for (const character of line) {
			if (character === '(') {
				opening += 1;
			}
			if (character === ')') {
				closing += 1;
			}
		}
		return opening - closing;
	}

	/** Responsibilities: _creation configuration reexport diagnostic_. **/
	public reexport_rule(): Rule {
		return new DiagnosticRule(this.reexport_rule_id);
	}

	/** Responsibilities: _aggregation facade reexport violations_. **/
	public append_reexport_violations(
		violations: Violation[],
		file: string,
		text: string,
		source: LintSourceRecord
	): void {
		if (source.python()) {
			this.append_python_reexport(violations, file, text, source.normalized_ast);
			return;
		}
		this.append_typescript_reexports(violations, file, source.typescript_ast.source_file_node());
	}
}
