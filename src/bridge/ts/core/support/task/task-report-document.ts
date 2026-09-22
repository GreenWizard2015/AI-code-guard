import type { ReportViolation } from 'src/bridge/ts/core/types';
import { TaskWorkspace } from 'src/bridge/ts/core/support/task/task-workspace';

/** Responsibilities: _group report violations_, _output reporting rendering_. **/
export class TaskReportDocument {
	private readonly workspace: TaskWorkspace;
	private readonly violations: readonly ReportViolation[];

	/** Responsibilities: _group violations markdown rule_. **/
	private rule_rows(): string[] {
		const grouped = new Map<string, ReportViolation[]>();
		for (const violation of this.violations) {
			let rule_violations = grouped.get(violation.rule_id);
			if (rule_violations === undefined) {
				rule_violations = [];
				grouped.set(violation.rule_id, rule_violations);
			}
			rule_violations.push(violation);
		}
		return [...grouped.entries()]
			.sort(([left_rule, left], [right_rule, right]) => {
				const count_difference = right.length - left.length;
				if (count_difference !== 0) {
					return count_difference;
				}
				return left_rule.localeCompare(right_rule);
			})
			.map(([rule_id, rule_violations]) => {
				const files = new Set(rule_violations.map(violation => violation.file));
				return `| \`${rule_id}\` | ${rule_violations.length} | ${files.size} |`;
			});
	}

	/** Responsibilities: _initialization reporting workspace violations_. **/
	public constructor(workspace: TaskWorkspace, violations: readonly ReportViolation[]) {
		this.workspace = workspace;
		this.violations = violations;
	}

	/** Responsibilities: _lint reporting markdown rendering_. **/
	public markdown(): string {
		const rows = this.rule_rows();
		if (rows.length === 0) {
			rows.push('| — | 0 | 0 |');
		}
		return [
			'# Lint report',
			'',
			'| Rule | Problems | Files |',
			'| --- | ---: | ---: |',
			...rows,
		].join('\n');
	}

	/** Responsibilities: _markdown report writing_. **/
	public write(): void {
		this.workspace.write_report(this.markdown());
	}
}
