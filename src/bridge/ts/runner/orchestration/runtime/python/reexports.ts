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

	/** Responsibilities: _aggregation TypeScript reexport violations_. **/
	private append_typescript_reexports(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile
	): void {
		const rule = this.reexport_rule();
		for (const statement of source_file.statements) {
if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier) {
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

		if ((!ast.python_imports?.length) || ast.functions.length > 0 || ast.classes.length > 0) {
			return false;
		}
		return !lines.some(item => reexport_names.implementation_line(item));
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
		this.append_typescript_reexports(violations, file, source.typescript_ast.source_file);
	}
}
