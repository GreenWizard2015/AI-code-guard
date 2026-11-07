# `union-contract-bypass`

Description: Do not hide required state fields behind a union of a base record and an intersection
that adds fields. Callers cannot rely on the added fields without narrowing every value.

## Bad

```ts
// File: src/types.ts
export type ReportViolationBase = { file: string; line: number };
export type ReportViolation = ReportViolationBase | (ReportViolationBase & {
	readonly rule_id: string;
	readonly severity: "warning" | "critical";
}); // <- error
// File: src/violation_report.ts
import type { ReportViolation } from "src/types";
/** Responsibilities: _violation location_, _violation summary_. **/
export class ViolationReport {
	private readonly violation: ReportViolation;
	/** Responsibilities: _violation report initialization_. **/
	public constructor(violation: ReportViolation) {
		this.violation = violation;
	}
	/** Responsibilities: _file and line composition_. **/
	public location(): string {
		return `${this.violation.file}:${this.violation.line}`;
	}
	/** Responsibilities: _violation summary composition_. **/
	public summary(): string {
		return `Violation at ${this.location()}`;
	}
	/** Responsibilities: _violation report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { ViolationReport } from "src/violation_report";
import type { ReportViolation } from "src/types";
(function () {
	const violation: ReportViolation = {
		file: "input.ts",
		line: 4,
		rule_id: "missing-value",
		severity: "warning",
	};
	const report = new ViolationReport(violation);
	report.report();
})();
```

## Good

```ts
// File: src/protocols.ts
export interface ReportViolationContract {
	summary(): string;
	report(): void;
}
// File: src/warning_violation.ts
import type { ReportViolationContract } from "src/protocols";
/** Responsibilities: _warning violation state_, _warning report composition_. **/
export class WarningViolation implements ReportViolationContract {
	private readonly _file: string;
	private readonly _line: number;
	private readonly _rule_id: string;
	/** Responsibilities: _warning location composition_. **/
	private location(): string {
		const normalized_file = this._file.trim();
		const normalized_line = String(this._line);
		return `${normalized_file}:${normalized_line}`;
	}
	/** Responsibilities: _warning violation initialization_. **/
	public constructor(file: string, line: number, rule_id: string) {
		this._file = file;
		this._line = line;
		this._rule_id = rule_id;
	}
	/** Responsibilities: _warning summary composition_. **/
	public summary(): string {
		const rule_label = this._rule_id.replaceAll("_", " ");
		const location = this.location();
		return `warning ${rule_label} at ${location}`;
	}
	/** Responsibilities: _warning report output_. **/
	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: src/critical_violation.ts
import type { ReportViolationContract } from "src/protocols";
/** Responsibilities: _critical violation state_, _critical report composition_. **/
export class CriticalViolation implements ReportViolationContract {
	private readonly _file: string;
	private readonly _line: number;
	private readonly _rule_id: string;
	/** Responsibilities: _critical location composition_. **/
	private location(): string {
		const normalized_file = this._file.trim();
		const normalized_line = String(this._line);
		return `${normalized_file}:${normalized_line}`;
	}
	/** Responsibilities: _critical violation initialization_. **/
	public constructor(file: string, line: number, rule_id: string) {
		this._file = file;
		this._line = line;
		this._rule_id = rule_id;
	}
	/** Responsibilities: _critical summary composition_. **/
	public summary(): string {
		const rule_label = this._rule_id.replaceAll("_", " ");
		const location = this.location();
		return `critical ${rule_label} at ${location}`;
	}
	/** Responsibilities: _critical report output_. **/
	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { WarningViolation } from "src/warning_violation";
import { CriticalViolation } from "src/critical_violation";
(function () {
	const warning = new WarningViolation("input.ts", 4, "missing-value");
	const critical = new CriticalViolation("config.ts", 8, "invalid-state");
	warning.report();
	critical.report();
})();
```
