import { TEST_PATH_SUFFIXES } from "src/constants";
import type { ViolationContract } from "src/reporting_protocols";
import type { TestPathSyntaxContract } from "src/shared_services_protocols";
import type {
	AgentFindingUnit,
	AgentFindingUnitCollectionContract,
	AgentPackageFeasibleAssignmentContract,
	AgentPackageFindingGroups,
	AgentPackagePartitionSelection,
	AgentPackagePlanLimits,
	AgentPackagePlanningRequest,
	AgentPackagePrioritySelectionContract,
	AgentPackageRetainedUnitSelection,
	AgentPackageRetentionRequest,
} from "src/task_selection_types";
import type { TestTargetLink } from "src/task_types";
import { TestPathSyntax } from "src/test_path_syntax";
import { TestPathKind } from "src/types";

/** Responsibilities: _priority selection_, _package capacity_. **/
export class AgentPackagePrioritySelection implements AgentPackagePrioritySelectionContract {
	private readonly _finding_units: AgentFindingUnitCollectionContract;
	private readonly _feasible_assignment: AgentPackageFeasibleAssignmentContract;
	private readonly _test_path_syntax: TestPathSyntaxContract;

	/** Responsibilities: _production and test findings_. **/
	private finding_groups(request: AgentPackagePlanningRequest): AgentPackageFindingGroups {
		const production: ViolationContract[] = [];
		const tests: ViolationContract[] = [];
		for (const violation of request.violations) {
			const test_file = this._test_path_syntax.classify(violation.file()).has(TestPathKind.TestFile);
			if (test_file) {
				tests.push(violation);
				continue;
			}
			production.push(violation);
		}
		return { production, tests };
	}

	/** Responsibilities: _priority ordered units_. **/
	private finding_units(
		production: readonly ViolationContract[],
		tests: readonly ViolationContract[],
		links: readonly TestTargetLink[],
	): AgentFindingUnit[] {
		const retained_findings = [...production, ...tests];
		const build_request = { violations: retained_findings, links };
		const units = this._finding_units.units(build_request);
		return this._finding_units.stable_order(units);
	}

	/** Responsibilities: _retained unit assignment_. **/
	private assign_retained_findings(
		limits: AgentPackagePlanLimits,
		selected_finding_count: number,
		retained_units: AgentFindingUnit[],
		excluded_findings: ViolationContract[],
	): AgentPackagePartitionSelection {
		let assignment = this._feasible_assignment.assign(retained_units, limits);
		while (!assignment.feasible && retained_units.length > 0) {
			const excluded_unit = retained_units.pop();
			if (excluded_unit !== undefined) {
				excluded_findings.push(...excluded_unit.violations);
			}
			assignment = this._feasible_assignment.assign(retained_units, limits);
		}
		if (!assignment.feasible) {
			throw new Error(`Cannot create a file-bounded agent package for ${selected_finding_count} selected findings.`);
		}
		return { assignment, excluded_findings };
	}

	/** Responsibilities: _priority capacity selection_. **/
	private feasible_selection(request: AgentPackageRetentionRequest): AgentPackagePartitionSelection {
		const selection = this.capacity_selected_units(request);
		const excluded_findings = [...selection.excluded_findings];
		const retained_units = [...selection.units];
		const selected_finding_count = request.production.length + request.tests.length;
		return this.assign_retained_findings(request.limits, selected_finding_count, retained_units, excluded_findings);
	}

	/** Responsibilities: _capacity selection_. **/
	private capacity_partition(
		units: AgentFindingUnit[],
		total_capacity: number,
		batch_size: number,
	): AgentPackageRetainedUnitSelection {
		const retained_units: AgentFindingUnit[] = [];
		const excluded_findings: ViolationContract[] = [];
		let retained_file_count = 0;
		for (const unit of units) {
			const unit_fits_package = unit.files.length <= batch_size;
			const unit_fits_total = retained_file_count + unit.files.length <= total_capacity;
			if (!unit_fits_package || !unit_fits_total) {
				excluded_findings.push(...unit.violations);
				continue;
			}
			retained_units.push(unit);
			retained_file_count += unit.files.length;
		}
		return { units: retained_units, excluded_findings };
	}

	/** Responsibilities: _per-package file capacity selection_. **/
	private capacity_selected_units(request: AgentPackageRetentionRequest): AgentPackageRetainedUnitSelection {
		const units = this.finding_units(request.production, request.tests, request.links);
		units.sort((left, right) => this.unit_priority_order(left, right));
		const total_capacity = request.limits.requested_count * request.limits.batch_size;
		return this.capacity_partition(units, total_capacity, request.limits.batch_size);
	}

	/** Responsibilities: _linked unit priority order_. **/
	private unit_priority_order(left: AgentFindingUnit, right: AgentFindingUnit): number {
		const highest_priority = (unit: AgentFindingUnit): number => {
			let highest = -1;
			for (const violation of unit.counted_violations) {
				highest = Math.max(highest, violation.priority());
			}
			return highest;
		};
		return highest_priority(right) - highest_priority(left);
	}

	/** Responsibilities: _priority selection dependencies_. **/
	public constructor(
		finding_units: AgentFindingUnitCollectionContract,
		feasible_assignment: AgentPackageFeasibleAssignmentContract,
	) {
		this._finding_units = finding_units;
		this._feasible_assignment = feasible_assignment;
		this._test_path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
	}

	/** Responsibilities: _capacity-bounded priority selection_. **/
	public select(request: AgentPackagePlanningRequest): AgentPackagePartitionSelection {
		const groups = this.finding_groups(request);
		return this.feasible_selection({
			production: groups.production,
			tests: groups.tests,
			links: request.links,
			limits: request.limits,
		});
	}
}
