import type { ReportViolation } from "src/types";
import { ViolationSummary } from "src/core/support/violation_summary";
import type { ViolationCounts } from "src/model/types/types";
import type { ViolationSummaryContract } from "src/protocols";

/** Responsibilities: _summarize report counts_, _determine failure status_. **/
export class ReportStatus {
	private readonly violations: readonly ReportViolation[];
	private readonly violation_summary: ViolationSummaryContract;

	/** Responsibilities: _violations initialization_, _summary state initialization_. **/
	public constructor(violations: readonly ReportViolation[]) {
		this.violations = violations;
		this.violation_summary = new ViolationSummary(violations);
	}

	/** Responsibilities: _output formatting reporting summary_. **/
	public summary(): string {
		const counts = this.violation_summary.counts();
		const lines = [
			`Total issues: ${counts.total}.`,
			`Total files: ${counts.files}.`,
		];
		return lines.join("\n");
	}

	/** Responsibilities: _exposure priority report counts_. **/
	public counts(): ViolationCounts {
		const counts = this.violation_summary.counts();
		return { ...counts };
	}

	/** Responsibilities: _reporting violations contain failures_. **/
	public warnings(): boolean {
		if (this.violations.length === 0) {
			return false;
		}
		return this.violation_summary.failures();
	}
}
