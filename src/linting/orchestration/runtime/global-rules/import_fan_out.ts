import ts from "typescript";

import { MAX_IMPORT_FAN_OUT } from "src/constants";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/reporting_protocols";
import type { ImportFanOutContract } from "src/linting/orchestration/runtime/protocols";
import type { NormalizedAstFile } from "src/types";

/** Responsibilities: _module dependencies_, _fan-out diagnostics_. **/
export class ImportFanOut implements ImportFanOutContract {
	private readonly max_imports: number;
	/** Responsibilities: _TypeScript import registration_. **/
	private append_typescript_module(modules: Set<string>, statement: ts.Statement): void {
		if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
			modules.add(statement.moduleSpecifier.text);
			return;
		}
		if (!ts.isImportEqualsDeclaration(statement)) {
			return;
		}
		if (!ts.isExternalModuleReference(statement.moduleReference)) {
			return;
		}
		if (ts.isStringLiteral(statement.moduleReference.expression)) {
			modules.add(statement.moduleReference.expression.text);
		}
	}

	/** Responsibilities: _TypeScript module dependencies_. **/
	private typescript_modules(source_file: ts.SourceFile): Set<string> {
		const modules = new Set<string>();
		for (const statement of source_file.statements) {
			this.append_typescript_module(modules, statement);
		}
		return modules;
	}

	/** Responsibilities: _excessive import fan-out violation_. **/
	private append_if_excessive(violations: ViolationContract[], file: string, count: number): void {
		if (count <= this.max_imports) {
			return;
		}
		const rule = new DiagnosticRule("import-fan-out");
		violations.push(rule.violation(file, 1));
	}

	/** Responsibilities: _fan-out policy initialization_. **/
	public constructor() {
		this.max_imports = MAX_IMPORT_FAN_OUT;
	}

	/** Responsibilities: _TypeScript import fan-out_. **/
	public append_typescript(violations: ViolationContract[], file: string, source_file: ts.SourceFile): void {
		this.append_if_excessive(violations, file, this.typescript_modules(source_file).size);
	}

	/** Responsibilities: _Python import fan-out_. **/
	public append_python(violations: ViolationContract[], file: string, ast: NormalizedAstFile): void {
		const source_modules = ast.python_imports.map((item) => item.module);
		const modules = new Set(source_modules);
		this.append_if_excessive(violations, file, modules.size);
	}
}
