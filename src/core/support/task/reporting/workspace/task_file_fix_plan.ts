import { TASK_REPORT_DIRECTORY_SCOPE } from "src/constants";
import { TaskViolationGroups } from "src/core/support/task/reporting/workspace/task_violation_groups";
import type {
	TaskFilePlanPath,
	TaskFilePlanPriorityLabels,
	TaskFilePlanRowsContext,
} from "src/core/support/task/reporting/workspace/types";
import type {
	TaskFileFixPlanRow,
	TaskFileSelection,
	TaskViolationSuppression,
	TaskViolationVisibility,
} from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _per-file priority plan_, _deferred diagnostic guidance_. **/
export class TaskFileFixPlan {
	private readonly _root: string;
	private readonly _violations: readonly ViolationContract[];
	private readonly _selection: TaskFileSelection;
	private readonly _visible_violations: readonly ViolationContract[];

	/** Responsibilities: _rule name aggregation_. **/
	private rule_labels(
		violations: readonly ViolationContract[],
		selected_violations: ReadonlySet<ViolationContract>,
	): string {
		const rule_ids = new Set<string>();
		for (const violation of violations) {
			if (selected_violations.has(violation)) {
				rule_ids.add(violation.rule_id());
			}
		}
		const ordered_rule_ids = [...rule_ids];
		ordered_rule_ids.sort();
		const labels: string[] = [];
		for (const rule_id of ordered_rule_ids) {
			labels.push(`\`${rule_id}\``);
		}
		if (labels.length === 0) {
			return "—";
		}
		return labels.join(", ");
	}

	/** Responsibilities: _deferred rule counts_. **/
	private deferred_rule_names(
		violations: readonly ViolationContract[],
		selected_violations: ReadonlySet<ViolationContract>,
	): string {
		const groups = new TaskViolationGroups(this._root, violations);
		const counts = groups.unselected_rule_counts(selected_violations);
		const ordered_entries = [...counts.entries()];
		ordered_entries.sort(([left], [right]) => left.localeCompare(right));
		const labels: string[] = [];
		for (const [rule_id, count] of ordered_entries) {
			labels.push(`\`${rule_id}\` (${count})`);
		}
		if (labels.length === 0) {
			return "—";
		}
		return labels.join(", ");
	}

	/** Responsibilities: _suppression explanation_. **/
	private suppression_text(suppressions: readonly TaskViolationSuppression[]): string {
		const details: string[] = [];
		for (const suppression of suppressions) {
			let reason = "placement suppression";
			if (suppression.scope === TASK_REPORT_DIRECTORY_SCOPE) {
				reason = "directory suppression";
			}
			details.push(
				`${suppression.violation.rule_id()} (line ${suppression.violation.line()}), ${reason} at \`${suppression.suppressor_path}\``,
			);
		}
		details.sort();
		if (details.length === 0) {
			return "—";
		}
		return details.join("; ");
	}

	/** Responsibilities: _path batch classification_. **/
	private batch_status(path: string, visible_count: number, selected_paths: ReadonlySet<string>): string {
		if (selected_paths.has(path)) {
			return "In current batch";
		}
		if (visible_count > 0) {
			return "Deferred by batch cap";
		}
		return "Suppressed";
	}

	/** Responsibilities: _priority rule labeling_. **/
	private priority_labels(path_plan: TaskFilePlanPath): TaskFilePlanPriorityLabels {
		if (!path_plan.has_visible_priority) {
			return { max_priority: "—", in_batch_rules: "—", deferred_rules: "—" };
		}
		const priority = path_plan.maximum_priority;
		let deferred_rules: string;
		if (path_plan.selected_paths.has(path_plan.path)) {
			deferred_rules = this.deferred_rule_names(path_plan.visible, path_plan.selected_violations);
		} else {
			deferred_rules = "—";
		}
		return {
			max_priority: String(priority),
			in_batch_rules: this.rule_labels(path_plan.visible, path_plan.selected_violations),
			deferred_rules,
		};
	}

	/** Responsibilities: _path row formatting_. **/
	private row(path_plan: TaskFilePlanPath): TaskFileFixPlanRow {
		const priority_labels = this.priority_labels(path_plan);
		return {
			path: path_plan.path,
			max_priority: priority_labels.max_priority,
			in_batch_rules: priority_labels.in_batch_rules,
			deferred_rules: priority_labels.deferred_rules,
			suppressed_diagnostics: this.suppression_text(path_plan.suppressed),
			batch_status: this.batch_status(path_plan.path, path_plan.visible.length, path_plan.selected_paths),
		};
	}

	/** Responsibilities: _path-specific repair rows_. **/
	private rows_for_paths(context: TaskFilePlanRowsContext): TaskFileFixPlanRow[] {
		const rows: TaskFileFixPlanRow[] = [];
		for (const path of context.ordered_paths) {
			const visible = context.visible_by_path.get(path);
			const suppressed = context.suppressed_by_path.get(path);
			const path_plan: TaskFilePlanPath = {
				path,
				visible: visible ?? [],
				suppressed: suppressed ?? [],
				maximum_priority: context.priorities.get(path) ?? 0,
				has_visible_priority: context.priorities.has(path),
				selected_paths: context.selected_paths,
				selected_violations: context.selected_violations,
			};
			rows.push(this.row(path_plan));
		}
		return rows;
	}

	/** Responsibilities: _file fix plan initialization_. **/
	public constructor(root: string, violations: readonly ViolationContract[], selection: TaskFileSelection) {
		this._root = root;
		this._violations = violations;
		this._selection = selection;
		this._visible_violations = selection.visibility.visible;
	}

	/** Responsibilities: _diagnostic path count_. **/
	public path_count(): number {
		const groups = new TaskViolationGroups(this._root, this._violations);
		const path_groups = groups.violations_by_path();
		return path_groups.size;
	}

	/** Responsibilities: _deterministic per-path repair rows_. **/
	public rows(): TaskFileFixPlanRow[] {
		const visibility: TaskViolationVisibility = this._selection.visibility;
		const visible_groups = new TaskViolationGroups(this._root, visibility.visible);
		const all_groups = new TaskViolationGroups(this._root, this._violations);
		const ordered_paths = [...all_groups.violations_by_path().keys()];
		ordered_paths.sort((left, right) => left.localeCompare(right));
		const suppression_groups = new TaskViolationGroups(this._root, []);
		const context: TaskFilePlanRowsContext = {
			ordered_paths,
			visible_by_path: visible_groups.violations_by_path(),
			suppressed_by_path: suppression_groups.suppressions_by_path(visibility.suppressed),
			priorities: visible_groups.path_priorities(),
			selected_paths: new Set(this._selection.files),
			selected_violations: new Set(this._selection.violations),
		};
		return this.rows_for_paths(context);
	}

	/** Responsibilities: _remaining visible diagnostic inventory_. **/
	public deferred_diagnostics(): ViolationContract[] {
		const selected = new Set(this._selection.violations);
		const deferred = this._visible_violations.filter((violation) => !selected.has(violation));
		deferred.sort((left, right) => {
			const file_order = left.file().localeCompare(right.file());
			if (file_order !== 0) {
				return file_order;
			}
			const line_order = left.line() - right.line();
			if (line_order !== 0) {
				return line_order;
			}
			return left.rule_id().localeCompare(right.rule_id());
		});
		return deferred;
	}
}
