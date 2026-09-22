import type { ReportViolation } from 'src/bridge/ts/core/types';
import type { ViolationPriorityCounts } from 'src/bridge/ts/core/support/types';

/** Responsibilities: _priority violation count_, _failure status determination_. **/
export class ViolationSummary {
	private readonly violations: readonly ReportViolation[];

	/** Responsibilities: _priority violation count_. **/
	private count(violations: ReportViolation[], priority: number): number {
		let count = 0;
		for (const violation of violations) {
			if (violation.priority === priority) {
				count += 1;
			}
		}
		return count;
	}

	/** Responsibilities: _violations initialization_. **/
	public constructor(violations: readonly ReportViolation[]) {
		this.violations = violations;
	}

	/** Responsibilities: _output counts grouped priority_. **/
	public counts(): ViolationPriorityCounts {
		return {
			priority_1: this.count([...this.violations], 1),
			priority_2: this.count([...this.violations], 2),
			priority_3: this.count([...this.violations], 3),
			files: new Set(this.violations.map(violation => violation.file)).size,
			total: this.violations.length,
		};
	}

	/** Responsibilities: _reporting any failure-priority violation_. **/
	public failures(): boolean {
		for (const violation of this.violations) {
			if (violation.priority >= 2) {
				return true;
			}
		}
		return false;
	}
}
