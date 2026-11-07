import { isAbsolute, resolve } from "node:path";
import {
	RULE_DATA_BY_ID,
	TASK_REPORT_DIRECTORY_SCOPE,
	TASK_REPORT_FILE_PLACEMENT_SCOPE,
	UNCLASSIFIED_TASK_REPORT_SCOPE,
} from "src/constants";
import { TaskViolationPath } from "src/core/support/task/reporting/workspace/task_violation_path";
import type { TaskScopedViolationPath } from "src/core/support/task/reporting/workspace/types";
import type { TaskReportDiagnosticScope } from "src/model/types";
import type { TaskViolationSuppression, TaskViolationVisibility } from "src/model_types";
import type { TaskViolationPathContract, ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _violation selection_, _violation suppression_, _rule grouping_. **/
export class TaskViolationGroups {
	private readonly _root: string;
	private readonly _violations: readonly ViolationContract[];

	/** Responsibilities: _catalog report scope resolution_. **/
	private report_scope(rule_id: string): TaskReportDiagnosticScope {
		const rule_data = RULE_DATA_BY_ID.get(rule_id);
		if (rule_data === undefined) {
			return UNCLASSIFIED_TASK_REPORT_SCOPE;
		}
		return rule_data.task_report_scope;
	}

	/** Responsibilities: _scope-specific path collection_. **/
	private normalized_path(file: string): string {
		if (isAbsolute(file)) {
			return file;
		}
		return resolve(this._root, file);
	}

	/** Responsibilities: _scope-specific path collection_. **/
	private scoped_paths(scope: TaskReportDiagnosticScope): TaskScopedViolationPath[] {
		const paths: TaskScopedViolationPath[] = [];
		for (const violation of this._violations) {
			if (this.report_scope(violation.rule_id()) === scope) {
				const file = violation.file();
				paths.push({ path: new TaskViolationPath(this._root, file), absolute_path: this.normalized_path(file) });
			}
		}
		return paths;
	}

	/** Responsibilities: _directory descendant suppression_. **/
	private append_directory_suppression(
		path: TaskViolationPathContract,
		directories: readonly TaskScopedViolationPath[],
		violation: ViolationContract,
		suppressed: TaskViolationSuppression[],
	): boolean {
		for (const directory of directories) {
			if (path.descendant_of(directory.path)) {
				suppressed.push({
					violation,
					scope: TASK_REPORT_DIRECTORY_SCOPE,
					suppressor_path: directory.absolute_path,
				});
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _same-file placement suppression_. **/
	private append_placement_suppression(
		path: TaskViolationPathContract,
		placement_paths: readonly TaskScopedViolationPath[],
		violation: ViolationContract,
		suppressed: TaskViolationSuppression[],
	): boolean {
		if (this.report_scope(violation.rule_id()) === TASK_REPORT_FILE_PLACEMENT_SCOPE) {
			return false;
		}
		for (const placement_path of placement_paths) {
			if (path.same_file_as(placement_path.path)) {
				suppressed.push({
					violation,
					scope: TASK_REPORT_FILE_PLACEMENT_SCOPE,
					suppressor_path: placement_path.absolute_path,
				});
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _task violation grouping initialization_. **/
	public constructor(root: string, violations: readonly ViolationContract[]) {
		this._root = root;
		this._violations = violations;
	}

	/** Responsibilities: _task report diagnostic suppression_. **/
	public analyze_visibility(): TaskViolationVisibility {
		const directory_paths = this.scoped_paths(TASK_REPORT_DIRECTORY_SCOPE);
		const placement_paths = this.scoped_paths(TASK_REPORT_FILE_PLACEMENT_SCOPE);
		const visible: ViolationContract[] = [];
		const suppressed: TaskViolationSuppression[] = [];
		for (const violation of this._violations) {
			const path = new TaskViolationPath(this._root, violation.file());
			if (this.append_directory_suppression(path, directory_paths, violation, suppressed)) {
				continue;
			}
			if (this.append_placement_suppression(path, placement_paths, violation, suppressed)) {
				continue;
			}
			visible.push(violation);
		}
		return { visible, suppressed };
	}

	/** Responsibilities: _path priority aggregation_. **/
	public path_priorities(): Map<string, number> {
		const priorities = new Map<string, number>();
		for (const violation of this._violations) {
			const path = this.normalized_path(violation.file());
			const current_priority = priorities.get(path);
			if (current_priority === undefined || violation.priority() > current_priority) {
				priorities.set(path, violation.priority());
			}
		}
		return priorities;
	}

	/** Responsibilities: _violations grouped by path_. **/
	public violations_by_path(): Map<string, ViolationContract[]> {
		const groups = new Map<string, ViolationContract[]>();
		for (const violation of this._violations) {
			const path = this.normalized_path(violation.file());
			let group = groups.get(path);
			if (group === undefined) {
				group = [];
				groups.set(path, group);
			}
			group.push(violation);
		}
		return groups;
	}

	/** Responsibilities: _suppression path grouping_. **/
	public suppressions_by_path(
		suppressions: readonly TaskViolationSuppression[],
	): Map<string, TaskViolationSuppression[]> {
		const groups = new Map<string, TaskViolationSuppression[]>();
		for (const suppression of suppressions) {
			const path = this.normalized_path(suppression.violation.file());
			let group = groups.get(path);
			if (group === undefined) {
				group = [];
				groups.set(path, group);
			}
			group.push(suppression);
		}
		return groups;
	}

	/** Responsibilities: _unselected rule counts_. **/
	public unselected_rule_counts(selected_violations: ReadonlySet<ViolationContract>): Map<string, number> {
		const counts = new Map<string, number>();
		for (const violation of this._violations) {
			if (selected_violations.has(violation)) {
				continue;
			}
			const rule_id = violation.rule_id();
			const count = counts.get(rule_id);
			if (count === undefined) {
				counts.set(rule_id, 1);
				continue;
			}
			counts.set(rule_id, count + 1);
		}
		return counts;
	}
}
