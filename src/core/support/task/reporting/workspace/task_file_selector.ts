import { resolve } from "node:path";
import { TaskViolationGroups } from "src/core/support/task/reporting/workspace/task_violation_groups";
import type { TaskFileSelection, TaskViolationVisibility } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { TaskFileSelectorContract } from "src/task_protocols";

/** Responsibilities: _priority category selection_, _impact-ordered file batching_. **/
export class TaskFileSelector implements TaskFileSelectorContract {
	private readonly _root: string;

	/** Responsibilities: _selection largest grouped rule_. **/
	private largest_rule_group(groups: ReadonlyMap<string, ViolationContract[]>): ViolationContract[] {
		let selected: ViolationContract[] = [];
		let selected_rule = "";
		for (const [rule_id, group] of groups) {
			if (group.length > selected.length || (group.length === selected.length && rule_id < selected_rule)) {
				selected = group;
				selected_rule = rule_id;
			}
		}
		return selected;
	}

	/** Responsibilities: _maximum-priority violation selection_. **/
	private priority_violations(input_violations: readonly ViolationContract[]): ViolationContract[] {
		let maximum_priority = 0;
		for (const violation of input_violations) {
			if (violation.priority() > maximum_priority) {
				maximum_priority = violation.priority();
			}
		}
		return input_violations.filter((violation) => violation.priority() === maximum_priority);
	}

	/** Responsibilities: _category file counts_. **/
	private file_counts(category_violations: readonly ViolationContract[]): Map<string, number> {
		const counts = new Map<string, number>();
		for (const violation of category_violations) {
			const file = resolve(this._root, violation.file());
			const count = counts.get(file);
			if (count === undefined) {
				counts.set(file, 1);
				continue;
			}
			counts.set(file, count + 1);
		}
		return counts;
	}

	/** Responsibilities: _category rule groups_. **/
	private rule_groups(grouped_violations: readonly ViolationContract[]): Map<string, ViolationContract[]> {
		const groups = new Map<string, ViolationContract[]>();
		for (const violation of grouped_violations) {
			const rule_id = violation.rule_id();
			const group = groups.get(rule_id);
			if (group === undefined) {
				groups.set(rule_id, [violation]);
				continue;
			}
			group.push(violation);
		}
		return groups;
	}

	/** Responsibilities: _violation file ordering_. **/
	private sorted_files(category: readonly ViolationContract[], counts: ReadonlyMap<string, number>): string[] {
		const files = new Set<string>();
		for (const violation of category) {
			files.add(resolve(this._root, violation.file()));
		}
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
		return ordered_files;
	}

	/** Responsibilities: _file priority ranking_. **/
	private ranked_files(
		priorities: ReadonlyMap<string, number>,
		violation_counts: ReadonlyMap<string, number>,
	): string[] {
		const files = [...priorities.keys()];
		files.sort((left, right) => {
			const left_priority = priorities.get(left);
			const right_priority = priorities.get(right);
			let priority_difference = 0;
			if (left_priority !== undefined && right_priority !== undefined) {
				priority_difference = right_priority - left_priority;
			}
			if (priority_difference !== 0) {
				return priority_difference;
			}
			const left_count = violation_counts.get(left) ?? 0;
			const right_count = violation_counts.get(right) ?? 0;
			const count_difference = right_count - left_count;
			if (count_difference !== 0) {
				return count_difference;
			}
			return left.localeCompare(right);
		});
		return files;
	}

	/** Responsibilities: _per-file maximum-priority violation selection_. **/
	private maximum_priority_violations(
		files: readonly string[],
		visible_violations: readonly ViolationContract[],
		priorities: ReadonlyMap<string, number>,
	): ViolationContract[] {
		const selected_files = new Set(files);
		return visible_violations.filter((violation) => {
			const file = resolve(this._root, violation.file());
			return selected_files.has(file) && priorities.get(file) === violation.priority();
		});
	}

	/** Responsibilities: _selection for chosen files_. **/
	private file_selection(
		files: string[],
		visible_violations: readonly ViolationContract[],
		visibility: TaskViolationVisibility,
	): TaskFileSelection {
		const selected_files = new Set(files);
		const selected_violations = visible_violations.filter((violation) => {
			return selected_files.has(resolve(this._root, violation.file()));
		});
		return { files, violations: selected_violations, visibility };
	}

	/** Responsibilities: _initialization task root usage_. **/
	public constructor(root: string) {
		this._root = root;
	}

	/** Responsibilities: _selection top rule category_. **/
	public select_top_category(violations: readonly ViolationContract[], batch_size: number): TaskFileSelection {
		const selection_groups = new TaskViolationGroups(this._root, violations);
		const visibility = selection_groups.analyze_visibility();
		const visible_violations = visibility.visible;
		const top_violations = this.priority_violations(visible_violations);
		const counts = this.file_counts(top_violations);
		const category = this.largest_rule_group(this.rule_groups(top_violations));
		const files = this.sorted_files(category, counts).slice(0, batch_size);
		return this.file_selection(files, visible_violations, visibility);
	}

	/** Responsibilities: _highest-priority file inclusion_. **/
	public select_all(violations: readonly ViolationContract[], batch_size: number): TaskFileSelection {
		const selection_groups = new TaskViolationGroups(this._root, violations);
		const visibility = selection_groups.analyze_visibility();
		const visible_violations = visibility.visible;
		const visible_groups = new TaskViolationGroups(this._root, visible_violations);
		const file_priorities = visible_groups.path_priorities();
		const file_counts = this.file_counts(visible_violations);
		const selected_files = this.ranked_files(file_priorities, file_counts).slice(0, batch_size);
		const selected_violations = this.maximum_priority_violations(selected_files, visible_violations, file_priorities);
		return { files: selected_files, violations: selected_violations, visibility };
	}
}
