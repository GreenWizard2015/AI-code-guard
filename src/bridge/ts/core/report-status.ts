import type { ReportViolation } from 'src/types';
import { ViolationSummary } from 'src/bridge/ts/core/support/violation-summary';
import type { ViolationPriorityCounts } from 'src/bridge/ts/core/support/types';
import { basename } from 'node:path';

/** Responsibilities: _summarize report counts_, _determine failure status_. **/
export class ReportStatus {
	private readonly violations: readonly ReportViolation[];
	private readonly files: readonly string[];
	private readonly violation_summary: ViolationSummary;

	/** Responsibilities: _report summary counts formatting_. **/
	private summary_text(counts: ViolationPriorityCounts): string {
		return [
			`Total issues: ${counts.total}.`,
			`Total files: ${counts.files}.`,
		].join('\n');
	}

	/** Responsibilities: _violations initialization_, _summary state initialization_. **/
	public constructor(violations: readonly ReportViolation[], files: readonly string[] = []) {
		this.violations = violations;
		this.files = files;
		this.violation_summary = new ViolationSummary(violations);
	}

	/** Responsibilities: _output formatting reporting summary_. **/
	public summary(): string {
		return this.summary_text(this.violation_summary.counts());
	}

	/** Responsibilities: _reporting violations contain failures_. **/
	public warnings(): boolean {
		if (this.files.some(file => ['functions.ts', 'functions.tsx', 'functions.py'].includes(basename(file)))) {
			return true;
		}
		if (this.violations.length === 0) {
			return false;
		}
		return this.violation_summary.failures();
	}
}
