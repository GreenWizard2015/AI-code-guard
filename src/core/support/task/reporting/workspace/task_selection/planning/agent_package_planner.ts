import { INVALID_AGENT_BATCH_SIZE_MESSAGE, MINIMUM_AGENT_BATCH_SIZE } from "src/core/constants";
import { AgentPackageFeasibleAssignment } from "src/core/support/task/reporting/workspace/task_selection/assignment/agent_package_feasible_assignment";
import { AgentPackagePrioritySelection } from "src/core/support/task/reporting/workspace/task_selection/assignment/agent_package_priority_selection";
import { AgentFindingUnitCollection } from "src/core/support/task/reporting/workspace/task_selection/assignment/ownership/agent_finding_unit_collection";
import { AgentPackageOwnership } from "src/core/support/task/reporting/workspace/task_selection/assignment/ownership/agent_package_ownership";
import { AgentPackageHistory } from "src/core/support/task/reporting/workspace/task_selection/planning/agent_package_history";
import { AgentPackagePlanLayout } from "src/core/support/task/reporting/workspace/task_selection/planning/agent_package_plan_layout";
import type { ViolationContract } from "src/reporting_protocols";
import type {
	AgentPackageHistoryContract,
	AgentPackagePlan,
	AgentPackagePlanLimits,
	AgentPackagePlannerContract,
	AgentPackagePlanningRequest,
	AgentPackagePreviousAssignment,
	AgentPackagePrioritySelectionContract,
} from "src/task_selection_types";
import type { TestTargetLink } from "src/task_types";

/** Responsibilities: _package planning_, _package layout_. **/
export class AgentPackagePlanner implements AgentPackagePlannerContract {
	private readonly _priority_selection: AgentPackagePrioritySelectionContract;
	private readonly _plan_layout: AgentPackagePlanLayout;

	/** Responsibilities: _package limits_. **/
	private validated_limits(request: AgentPackagePlanLimits): AgentPackagePlanLimits {
		const { requested_count, batch_size } = request;
		if (!Number.isInteger(requested_count) || requested_count < 1) {
			throw new Error(`Invalid --agents value: ${requested_count}`);
		}
		if (!Number.isInteger(batch_size) || batch_size < MINIMUM_AGENT_BATCH_SIZE) {
			throw new Error(INVALID_AGENT_BATCH_SIZE_MESSAGE);
		}
		return request;
	}

	/** Responsibilities: _priority-bounded plan_. **/
	private priority_plan(request: AgentPackagePlanningRequest): AgentPackagePlan {
		const selection = this._priority_selection.select(request);
		const bins = selection.assignment.bins;
		const packages = this._plan_layout.work_packages({ bins, links: request.links });
		const plan_request = {
			requested_count: request.limits.requested_count,
			batch_size: request.limits.batch_size,
			unresolved_partition_constraints: 0,
			excluded_findings: selection.excluded_findings,
		};
		return this._plan_layout.plan(plan_request, packages);
	}

	/** Responsibilities: _planner collaborators_. **/
	public constructor(root: string, previous_assignments: readonly AgentPackagePreviousAssignment[] = []) {
		const history: AgentPackageHistoryContract = new AgentPackageHistory(root, previous_assignments);
		const ownership = new AgentPackageOwnership(history);
		const finding_units = new AgentFindingUnitCollection(ownership, history);
		const feasible_assignment = new AgentPackageFeasibleAssignment(ownership);
		this._priority_selection = new AgentPackagePrioritySelection(finding_units, feasible_assignment);
		this._plan_layout = new AgentPackagePlanLayout(root);
	}

	/** Responsibilities: _package plan_. **/
	public plan(
		violations: readonly ViolationContract[],
		links: readonly TestTargetLink[],
		requested_count: number,
		batch_size: number,
	): AgentPackagePlan {
		const limits = this.validated_limits({ requested_count, batch_size });
		if (violations.length === 0) {
			return {
				requested_count: limits.requested_count,
				batch_size: limits.batch_size,
				unresolved_partition_constraints: 0,
				excluded_findings: [],
				packages: [],
			};
		}
		return this.priority_plan({ violations, links, limits });
	}
}
