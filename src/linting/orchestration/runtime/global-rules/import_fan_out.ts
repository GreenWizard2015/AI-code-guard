import type { ImportFanOutContract } from "src/contracts/protocols/lint_runtime_protocols";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _module dependencies_, _fan-out diagnostics_. **/
export class ImportFanOut implements ImportFanOutContract {
	private readonly _max_imports: number;
	private readonly _rule: RuleContract;
	/** Responsibilities: _excessive import fan-out violation_. **/
	private excessive_violations(file: string, count: number): ViolationContract[] {
		if (count <= this._max_imports) {
			return [];
		}
		return [this._rule.violation(file, 1, {})];
	}

	/** Responsibilities: _fan-out policy initialization_. **/
	public constructor(max_imports: number, rule: RuleContract) {
		this._max_imports = max_imports;
		this._rule = rule;
	}

	/** Responsibilities: _language-specific import fan-out_. **/
	public append(violations: ViolationContract[], source: LintSourceRecordData): void {
		if (source.language !== "python") {
			return;
		}
		const imports = source.normalized_ast.source.python_imports;
		const modules = new Set(imports.map((item) => item.module));
		violations.push(...this.excessive_violations(source.relative_path, modules.size));
	}
}
