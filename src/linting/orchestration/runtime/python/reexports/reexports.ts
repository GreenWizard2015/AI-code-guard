import { ReexportNames } from "src/linting/orchestration/runtime/python/reexports/reexport_names";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract, ViolationContract } from "src/reporting_protocols";
import type { TypeScriptReexportsContract } from "src/typescript_runtime_protocols";
import type {
	ReexportNamesContract,
	ReexportsContract,
} from "src/linting/orchestration/runtime/protocols";
import type { LintSourceRecord } from "src/source_types";
import type { NormalizedAstFile } from "src/types";
import { PYTHON_PACKAGE_SUFFIX } from "src/constants";

/** Responsibilities: _Python facade detection_, _reexport violation reporting_. **/
export class Reexports implements ReexportsContract {
	private readonly reexport_rule_id = "reexports";
	private readonly python_init_file = PYTHON_PACKAGE_SUFFIX;
	private readonly typescript_reexports: TypeScriptReexportsContract;

	/** Responsibilities: _inspection Python import facade_. **/
	private append_python_reexport(
		violations: ViolationContract[],
		file: string,
		text: string,
		ast: NormalizedAstFile,
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
	private append_python_violation(violations: ViolationContract[], file: string, line: number): void {
		const rule = this.reexport_rule();
		violations.push(
			rule.violation(file, line + 1, {
				reason: "use the defining module directly instead of a re-export facade",
			}),
		);
	}

	/** Responsibilities: _classification diagnostic line Python_. **/
	private python_facade_line(text: string, ast: NormalizedAstFile): number {
		const lines = text.split("\n");
		if (!this.is_python_facade(lines, ast)) {
			return -1;
		}
		const imports = ast.python_imports;
		if (imports === undefined) {
			return -1;
		}
		if (imports.length === 0) {
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
		if (ast.functions.length > 0) {
			return false;
		}
		if (ast.classes.length > 0) {
			return false;
		}
		return this.facade_lines(lines, reexport_names);
	}

	/** Responsibilities: _facade line structure_. **/
	private facade_lines(lines: string[], reexport_names: ReexportNamesContract): boolean {
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
		if (line.startsWith("from ")) {
			return this.parenthesis_delta(line);
		}
		if (line.startsWith("import ")) {
			return this.parenthesis_delta(line);
		}
		return -1;
	}

	/** Responsibilities: _count multiline import parentheses_. **/
	private parenthesis_delta(line: string): number {
		let opening = 0;
		let closing = 0;
		for (const character of line) {
			if (character === "(") {
				opening += 1;
			}
			if (character === ")") {
				closing += 1;
			}
		}
		return opening - closing;
	}

	/** Responsibilities: _reexport dependency initialization_. **/
	public constructor(typescript_reexports: TypeScriptReexportsContract) {
		this.typescript_reexports = typescript_reexports;
	}

	/** Responsibilities: _creation configuration reexport diagnostic_. **/
	public reexport_rule(): RuleContract {
		return new DiagnosticRule(this.reexport_rule_id);
	}

	/** Responsibilities: _aggregation facade reexport violations_. **/
	public append_reexport_violations(
		violations: ViolationContract[],
		file: string,
		text: string,
		source: LintSourceRecord,
	): void {
		if (source.python()) {
			this.append_python_reexport(violations, file, text, source.normalized_ast);
			return;
		}
		this.typescript_reexports.append(violations, file, source.typescript_ast.source_file_node());
	}
}
