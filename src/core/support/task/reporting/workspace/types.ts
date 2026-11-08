import type { TaskViolationSuppression } from "src/model_types";
import type { TaskViolationPathContract, ViolationContract } from "src/reporting_protocols";
import type { TaskReviewAgentContract } from "src/task_protocols";

export type CallableReviewAgentProvider = () => TaskReviewAgentContract;

export type TaskScopedViolationPath = {
	path: TaskViolationPathContract;
	absolute_path: string;
};

export type TaskFilePlanPath = {
	path: string;
	visible: readonly ViolationContract[];
	suppressed: readonly TaskViolationSuppression[];
	maximum_priority: number;
	has_visible_priority: boolean;
	selected_paths: ReadonlySet<string>;
	selected_violations: ReadonlySet<ViolationContract>;
};

export type TaskFilePlanRowsContext = {
	ordered_paths: readonly string[];
	visible_by_path: ReadonlyMap<string, ViolationContract[]>;
	suppressed_by_path: ReadonlyMap<string, TaskViolationSuppression[]>;
	priorities: ReadonlyMap<string, number>;
	selected_paths: ReadonlySet<string>;
	selected_violations: ReadonlySet<ViolationContract>;
};

export type TaskFilePlanPriorityLabels = {
	max_priority: string;
	in_batch_rules: string;
	deferred_rules: string;
};
