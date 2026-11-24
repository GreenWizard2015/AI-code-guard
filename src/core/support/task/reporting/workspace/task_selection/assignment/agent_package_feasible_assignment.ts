import { MINIMUM_AGENT_BATCH_SIZE } from "src/core/constants";
import { AgentPackageAssignmentSearch } from "src/core/support/task/reporting/workspace/task_selection/assignment/agent_package_assignment_search";
import { AgentPackageBin } from "src/core/support/task/reporting/workspace/task_selection/assignment/agent_package_bin";
import type {
	AgentFindingUnit,
	AgentPackageAssignmentContext,
	AgentPackageAssignmentResult,
	AgentPackageFeasibleAssignmentContract,
	AgentPackageOwnershipContract,
	AgentPackagePlanLimits,
} from "src/task_selection_types";

/** Responsibilities: _bounded package assignments_, _capacity feasibility_. **/
export class AgentPackageFeasibleAssignment implements AgentPackageFeasibleAssignmentContract {
	private readonly _ownership: AgentPackageOwnershipContract;

	/** Responsibilities: _package count ceiling_. **/
	private maximum_package_count(total_files: number, requested_count: number): number {
		if (total_files < MINIMUM_AGENT_BATCH_SIZE) {
			return 1;
		}
		return Math.min(requested_count, Math.floor(total_files / MINIMUM_AGENT_BATCH_SIZE));
	}

	/** Responsibilities: _priority distribution targets_. **/
	private target_priorities(assignment_units: readonly AgentFindingUnit[], package_count: number): Map<number, number> {
		const priority_totals = new Map<number, number>();
		for (const unit of assignment_units) {
			for (const [priority, count] of unit.counts_by_priority) {
				const current = priority_totals.get(priority) ?? 0;
				priority_totals.set(priority, current + count);
			}
		}
		const targets = new Map<number, number>();
		for (const [priority, count] of priority_totals) {
			targets.set(priority, count / package_count);
		}
		return targets;
	}

	/** Responsibilities: _minimum package size_. **/
	private minimum_package_files(total_files: number, package_count: number): number {
		if (total_files === 0 && package_count === 1) {
			return 0;
		}
		if (total_files < MINIMUM_AGENT_BATCH_SIZE && package_count === 1) {
			return 1;
		}
		return MINIMUM_AGENT_BATCH_SIZE;
	}

	/** Responsibilities: _assignment state_. **/
	private assignment_context(
		units: readonly AgentFindingUnit[],
		package_numbers: readonly number[],
		limits: AgentPackagePlanLimits,
	): AgentPackageAssignmentContext {
		const ordered_units = [...units];
		ordered_units.sort((left, right) => right.files.length - left.files.length);
		const total_files = ordered_units.reduce((total, unit) => total + unit.files.length, 0);
		const target_priorities = this.target_priorities(units, package_numbers.length);
		const bins = package_numbers.map((package_number) => new AgentPackageBin(package_number));
		const preserve_ownership = units.some((unit) => this._ownership.owner_for_unit(unit) > 0);
		const min_package_files = this.minimum_package_files(total_files, bins.length);
		return {
			units: ordered_units,
			bins,
			batch_size: limits.batch_size,
			min_package_files,
			target_file_count: total_files / bins.length,
			target_priorities,
			preserve_ownership,
			failed: new Set<string>(),
		};
	}

	/** Responsibilities: _assignment dependencies_. **/
	public constructor(ownership: AgentPackageOwnershipContract) {
		this._ownership = ownership;
	}

	/** Responsibilities: _feasible package assignment_. **/
	public assign(units: readonly AgentFindingUnit[], limits: AgentPackagePlanLimits): AgentPackageAssignmentResult {
		const total_files = units.reduce((total, unit) => total + unit.files.length, 0);
		if (units.length === 0 || total_files === 0) {
			return { feasible: false, bins: [] };
		}
		const maximum = this.maximum_package_count(total_files, limits.requested_count);
		const minimum = Math.max(1, Math.ceil(total_files / limits.batch_size));
		for (let count = maximum; count >= minimum; count -= 1) {
			const package_numbers = this._ownership.package_numbers(units, count, limits.requested_count);
			const context = this.assignment_context(units, package_numbers, limits);
			const assignment_search = new AgentPackageAssignmentSearch(context, this._ownership);
			const result = assignment_search.assign();
			if (result.feasible) {
				return result;
			}
		}
		return { feasible: false, bins: [] };
	}
}
