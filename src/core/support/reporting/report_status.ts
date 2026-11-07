import { ViolationSummary } from "src/core/support/reporting/violation_summary";
import type { ViolationCounts } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { ViolationSummaryContract } from "src/reporting_protocols";

/** Responsibilities: _summarize report counts_, _determine failure status_. **/
export class ReportStatus {
	private readonly _violations: readonly ViolationContract[];
	private readonly _violation_summary: ViolationSummaryContract;

	/** Responsibilities: _violations initialization_, _summary state initialization_. **/
	public constructor(violations: readonly ViolationContract[]) {
		this._violations = violations;
		this._violation_summary = new ViolationSummary(violations);
	}

	/** Responsibilities: _output formatting reporting summary_. **/
	public summary(): string {
		const counts = this._violation_summary.counts();
		const lines = [`Total issues: ${counts.total}.`, `Total files: ${counts.files}.`];
		return lines.join("\n");
	}

	/** Responsibilities: _exposure priority report counts_. **/
	public counts(): ViolationCounts {
		const counts = this._violation_summary.counts();
		return { ...counts };
	}

	/** Responsibilities: _reporting violations contain failures_. **/
	public warnings(): boolean {
		if (this._violations.length === 0) {
			return false;
		}
		return this._violation_summary.failures();
	}
}
