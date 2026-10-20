import { isAbsolute, resolve } from "node:path";
import type { ReportViolation } from "src/reporting_protocols";
import { TaskViolationGroups } from "src/core/support/task/task_violation_groups";
import type { TaskFileSelection } from "src/model/types/types";

/** Responsibilities: _priority category selection_, _impact-ordered file batching_. **/
export class TaskFileSelector {
	private readonly root: string;

	/** Responsibilities: _resolution reporting file path_. **/
	private absolute_file(file: string): string {
		if (isAbsolute(file)) {
			return file;
		}
		return resolve(this.root, file);
	}

	/** Responsibilities: _selection largest grouped rule_. **/
	private largest_rule_group(groups: ReadonlyMap<string, ReportViolation[]>): ReportViolation[] {
		let selected: ReportViolation[] = [];
		let selected_rule = "";
		for (const [rule_id, group] of groups) {
			if (group.length > selected.length || (group.length === selected.length && rule_id < selected_rule)) {
				selected = group;
				selected_rule = rule_id;
			}
		}
		return selected;
	}

	/** Responsibilities: _order violating files their_. **/
	private sorted_files(
		category: readonly ReportViolation[],
		counts: ReadonlyMap<string, number>,
		batch_size: number,
	): string[] {
		const files = new Set(category.map((violation) => this.absolute_file(violation.file)));
		const ordered_files = [...files];
		ordered_files.sort((left, right) => {
				const left_count = counts.get(left);
				const right_count = counts.get(right);
				let count_difference = 0;
				if (left_count !== undefined && right_count !== undefined) {
					count_difference = right_count - left_count;
				}
				if (count_difference !== 0) {
					return count_difference;
				}
				return left.localeCompare(right);
		});
		return ordered_files.slice(0, batch_size);
	}

	/** Responsibilities: _selection highest-impact violations task_. **/
	private selected_violations(violations: readonly ReportViolation[], files: readonly string[]): ReportViolation[] {
		const selected_files = new Set(files);
		const result: ReportViolation[] = [];
		for (const violation of violations) {
			if (selected_files.has(this.absolute_file(violation.file))) {
				result.push(violation);
			}
		}
		return result;
	}

	/** Responsibilities: _initialization task root usage_. **/
	public constructor(root: string) {
		this.root = root;
	}

	/** Responsibilities: _selection top rule category_. **/
	public select_top_category(violations: readonly ReportViolation[], batch_size: number): TaskFileSelection {
		const violation_groups = new TaskViolationGroups(this.root);
		const priority = violation_groups.top_priority(violations);
		const top_violations = violation_groups.at_priority(violations, priority);
		const counts = violation_groups.file_counts(top_violations);
		const category = this.largest_rule_group(violation_groups.by_rule(top_violations));
		const files = this.sorted_files(category, counts, batch_size);
		return { files, violations: this.selected_violations(violations, files) };
	}

	/** Responsibilities: _selection violations preservation grouped_. **/
	public select_all(violations: readonly ReportViolation[], batch_size: number): TaskFileSelection {
		const violation_groups = new TaskViolationGroups(this.root);
		const priority = violation_groups.top_priority(violations);
		const top_violations = violation_groups.at_priority(violations, priority);
		const counts = violation_groups.file_counts(top_violations);
		const files = [...counts.keys()];
		files.sort();
		const selected_files = files.slice(0, batch_size);
		return { files: selected_files, violations: this.selected_violations(violations, selected_files) };
	}
}
