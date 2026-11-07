import { REPORT_OTHER_RULES_LABEL, REPORT_RULE_DISPLAY_LIMIT } from "src/core/support/task/constants";
import { TaskRuleLanguageGroups } from "src/core/support/task/reporting/task_rule_language_groups";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _rule row formatting_, _overflow summary formatting_. **/
export class TaskReportViolationRows {
	private readonly _groups: ReadonlyMap<string, ViolationContract[]>;

	/** Responsibilities: _rule count lookup_. **/
	private rule_count(rule_id: string): number {
		const violations = this._groups.get(rule_id);
		if (violations === undefined) {
			return 0;
		}
		return violations.length;
	}

	/** Responsibilities: _rule count ordering_. **/
	private compare_rule_ids(left_rule: string, right_rule: string): number {
		const count_difference = this.rule_count(right_rule) - this.rule_count(left_rule);
		if (count_difference !== 0) {
			return count_difference;
		}
		return left_rule.localeCompare(right_rule);
	}

	/** Responsibilities: _rule priority order_. **/
	private sorted_rule_ids(): string[] {
		const rule_ids = [...this._groups.keys()];
		rule_ids.sort((left_rule, right_rule) => this.compare_rule_ids(left_rule, right_rule));
		return rule_ids;
	}

	/** Responsibilities: _overflow problem totals_. **/
	private remaining_problem_count(rule_ids: readonly string[]): number {
		let count = 0;
		for (const rule_id of rule_ids.slice(REPORT_RULE_DISPLAY_LIMIT)) {
			count += this.rule_count(rule_id);
		}
		return count;
	}

	/** Responsibilities: _overflow file totals_. **/
	private remaining_file_count(rule_ids: readonly string[]): number {
		const files = new Set<string>();
		for (const rule_id of rule_ids.slice(REPORT_RULE_DISPLAY_LIMIT)) {
			const violations = this._groups.get(rule_id);
			if (violations === undefined) {
				continue;
			}
			for (const violation of violations) {
				files.add(violation.file());
			}
		}
		return files.size;
	}

	/** Responsibilities: _report violations ownership_. **/
	public constructor(violations: readonly ViolationContract[]) {
		const language_groups = new TaskRuleLanguageGroups(violations);
		this._groups = language_groups.grouped_violations();
	}

	/** Responsibilities: _visible rule row rendering_. **/
	public visible_rows(): string[] {
		const rule_ids = this.sorted_rule_ids();
		const rows: string[] = [];
		for (const rule_id of rule_ids.slice(0, REPORT_RULE_DISPLAY_LIMIT)) {
			const violations = this._groups.get(rule_id);
			if (violations === undefined) {
				continue;
			}
			const files = new Set(violations.map((violation) => violation.file()));
			rows.push(`| \`${rule_id}\` | ${violations.length} | ${files.size} |`);
		}
		return rows;
	}

	/** Responsibilities: _overflow row rendering_. **/
	public remaining_row(): string {
		const rule_ids = this.sorted_rule_ids();
		const problem_count = this.remaining_problem_count(rule_ids);
		if (problem_count === 0) {
			return "";
		}
		const file_count = this.remaining_file_count(rule_ids);
		return `| ${REPORT_OTHER_RULES_LABEL} | ${problem_count} | ${file_count} |`;
	}
}
