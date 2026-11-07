import { TypeScriptReexportViolationCollector } from "src/linting/orchestration/runtime/reexports/type_script_reexport_violation_collector";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { TypeScriptReexportsContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _import alias collection_, _reexport violation detection_. **/
export class TypeScriptReexports implements TypeScriptReexportsContract {
	private readonly _rule: RuleContract;

	/** Responsibilities: _reexport diagnostic initialization_. **/
	public constructor(rule: RuleContract) {
		this._rule = rule;
	}

	/** Responsibilities: _aggregation TypeScript reexport violations_. **/
	public append(violations: ViolationContract[], file: string, source_file: ts.SourceFile): void {
		const collector = new TypeScriptReexportViolationCollector(this._rule, file, source_file, violations);
		collector.index_import_bindings();
		for (const statement of source_file.statements) {
			if (ts.isExportDeclaration(statement)) {
				collector.append_declaration(statement);
				continue;
			}
			if (ts.isExportAssignment(statement)) {
				collector.append_assignment(statement);
			}
		}
	}
}
