import type { ReportViolation } from "src/reporting_protocols";
import type { ViolationCounts } from "src/model/types/types";
import type { ViolationSummaryContract } from "src/reporting_protocols";

/** Responsibilities: _priority violation count_, _failure status determination_. **/
export class ViolationSummary implements ViolationSummaryContract {
	private readonly violations: readonly ReportViolation[];

	/** Responsibilities: _violations initialization_. **/
	public constructor(violations: readonly ReportViolation[]) {
		this.violations = violations;
	}

	/** Responsibilities: _output counts grouped priority_. **/
	public counts(): ViolationCounts {
		const files = new Set(this.violations.map((violation) => violation.file));
		return {
			files: files.size,
			total: this.violations.length,
		};
	}

	/** Responsibilities: _reporting any failure-priority violation_. **/
	public failures(): boolean {
		for (const violation of this.violations) {
			if (violation.priority === 0 || violation.priority >= 2) {
				return true;
			}
		}
		return false;
	}
}
