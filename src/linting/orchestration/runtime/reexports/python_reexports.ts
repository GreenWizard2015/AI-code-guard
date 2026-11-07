import { PYTHON_PACKAGE_SUFFIX } from "src/constants";
import type { ReexportsContract } from "src/contracts/protocols/lint_runtime_protocols";
import { PythonReexportLine } from "src/linting/orchestration/runtime/reexports/python_reexport_line";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type { TypeScriptReexportsContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _Python facade detection_, _reexport violation reporting_. **/
export class PythonReexports implements ReexportsContract {
	private readonly _reexport_rule_id: string;
	private readonly _python_init_file: string;
	private readonly _typescript_reexports: TypeScriptReexportsContract;
	private readonly _name_start_pattern: RegExp;
	private readonly _name_character_pattern: RegExp;

	/** Responsibilities: _Python import facade line_. **/
	private facade_line(text: string, ast: NormalizedAstFile): number {
		const lines = text.split("\n");
		if (!this.is_python_facade(lines, ast)) {
			return -1;
		}
		const imports = ast.source.python_imports;
		if (imports === undefined || imports.length === 0) {
			return -1;
		}
		for (const import_node of imports) {
			return import_node.line;
		}
		return -1;
	}

	/** Responsibilities: _Python source facade_. **/
	private is_python_facade(lines: string[], ast: NormalizedAstFile): boolean {
		const imports = ast.source.python_imports;
		if (imports === undefined || imports.length === 0) {
			return false;
		}
		if (ast.source.functions.length > 0 || ast.source.classes.length > 0) {
			return false;
		}
		return this.facade_lines(lines);
	}

	/** Responsibilities: _Python facade line structure_. **/
	private facade_lines(lines: string[]): boolean {
		let import_depth = 0;
		for (const line of lines) {
			const syntax = new PythonReexportLine(line.trim(), this._name_start_pattern, this._name_character_pattern);
			const next_depth = syntax.next_import_depth(import_depth);
			if (next_depth >= 0) {
				import_depth = next_depth;
				continue;
			}
			if (syntax.implementation_line()) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _reexport dependencies_. **/
	public constructor(
		typescript_reexports: TypeScriptReexportsContract,
		name_start_pattern: RegExp,
		name_character_pattern: RegExp,
	) {
		this._reexport_rule_id = "reexports";
		this._python_init_file = PYTHON_PACKAGE_SUFFIX;
		this._typescript_reexports = typescript_reexports;
		this._name_start_pattern = name_start_pattern;
		this._name_character_pattern = name_character_pattern;
	}

	/** Responsibilities: _reexport diagnostic rule_. **/
	public reexport_rule(): RuleContract {
		return new DiagnosticRule(this._reexport_rule_id);
	}

	/** Responsibilities: _facade reexport violations_. **/
	public append_reexport_violations(
		violations: ViolationContract[],
		file: string,
		text: string,
		source: LintSourceRecordData,
	): void {
		if (source.language === "python") {
			if (file.endsWith(this._python_init_file)) {
				return;
			}
			const line = this.facade_line(text, source.normalized_ast);
			if (line >= 0) {
				violations.push(
					this.reexport_rule().violation(file, line + 1, {
						reason: "use the defining module directly instead of a re-export facade",
					}),
				);
			}
			return;
		}
		this._typescript_reexports.append(violations, file, source.typescript_ast.source_file_node());
	}
}
