import type { ViolationCounts } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { ViolationSummaryContract } from "src/reporting_protocols";

/** Responsibilities: _priority violation count_, _failure status determination_. **/
export class ViolationSummary implements ViolationSummaryContract {
	private readonly _violations: readonly ViolationContract[];

	/** Responsibilities: _violations initialization_. **/
	public constructor(violations: readonly ViolationContract[]) {
		this._violations = violations;
	}

	/** Responsibilities: _output counts grouped priority_. **/
	public counts(): ViolationCounts {
		const files = new Set(this._violations.map((violation) => violation.file()));
		return {
			files: files.size,
			total: this._violations.length,
		};
	}

	/** Responsibilities: _reporting any failure-priority violation_. **/
	public failures(): boolean {
		for (const violation of this._violations) {
			if (violation.priority() === 0 || violation.priority() >= 2) {
				return true;
			}
		}
		return false;
	}
}
