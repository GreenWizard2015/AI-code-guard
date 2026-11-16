import type { ViolationContract } from "src/reporting_protocols";
import type { LintTaskPolicy, TestTargetLink } from "src/task_types";

/** Responsibilities: _bin evaluation output_. **/
export type AgentPackageBinEvaluation = {
	readonly within_capacity: boolean;
	readonly balance_score: number;
};

/** Responsibilities: _bin candidate scoring inputs_. **/
export type AgentPackageBinEvaluationRequest = {
	readonly package_number: number;
	readonly unit: AgentFindingUnit;
	readonly batch_size: number;
	readonly target_file_count: number;
	readonly target_priorities: ReadonlyMap<number, number>;
};

/** Responsibilities: _package bin behavior_. **/
export interface AgentPackageBinContract {
	package_number(): number;
	units(): readonly AgentFindingUnit[];
	finding_count(): number;
	file_count(): number;
	signature(): string;
	evaluate(request: AgentPackageBinEvaluationRequest): AgentPackageBinEvaluation;
	apply_change(change: AgentPackageBinChange): void;
}

/** Responsibilities: _unit collection contract_. **/
export interface AgentFindingUnitCollectionContract {
	units(request: AgentPackageUnitBuildRequest): AgentFindingUnit[];
	stable_order(units: readonly AgentFindingUnit[]): AgentFindingUnit[];
}

/** Responsibilities: _feasible package assignment behavior_. **/
export interface AgentPackageFeasibleAssignmentContract {
	assign(units: readonly AgentFindingUnit[], limits: AgentPackagePlanLimits): AgentPackageAssignmentResult;
}

/** Responsibilities: _priority package selection behavior_. **/
export interface AgentPackagePrioritySelectionContract {
	select(request: AgentPackagePlanningRequest): AgentPackagePartitionSelection;
}

/** Responsibilities: _file component behavior_. **/
export interface AgentPackageComponentsContract {
	component(file: string): string;
	link(left: string, right: string): void;
	groups(): Map<string, string[]>;
}

/** Responsibilities: _planned package paths and findings_. **/
export type AgentWorkPackage = {
	readonly number: number;
	readonly violations: readonly ViolationContract[];
	readonly files: readonly string[];
	readonly production_paths: readonly string[];
	readonly test_paths: readonly string[];
	readonly path_scopes: readonly string[];
	readonly test_target_links: readonly TestTargetLink[];
};

/** Responsibilities: _complete package selection result_. **/
export type AgentPackagePlan = {
	readonly requested_count: number;
	readonly batch_size: number;
	readonly unresolved_partition_constraints: number;
	readonly excluded_findings: readonly ViolationContract[];
	readonly packages: readonly AgentWorkPackage[];
};

/** Responsibilities: _prior package ownership_. **/
export type AgentPackagePreviousAssignment = {
	readonly package_number: number;
	readonly files: readonly string[];
	readonly path_scopes: readonly string[];
};

/** Responsibilities: _package ownership behavior_. **/
export interface AgentPackageOwnershipContract {
	owner_for_unit(unit: AgentFindingUnit): number;
	compare_units(left: AgentFindingUnit, right: AgentFindingUnit): number;
	retention_score(candidate: AgentPackageCandidate): number;
	package_numbers(units: readonly AgentFindingUnit[], package_count: number, requested_count: number): number[];
}

/** Responsibilities: _previous package paths_, _ownership history state_. **/
export interface AgentPackageHistoryContract {
	normalized_path(file: string): string;
	owner_for_file(file: string): number;
}

/** Responsibilities: _plan validation behavior_. **/
export interface AgentPackagePlanValidatorContract {
	validate(plan: AgentPackagePlan, selected_findings: readonly ViolationContract[]): void;
}

/** Responsibilities: _agent package planning boundary_. **/
export interface AgentPackagePlannerContract {
	plan(
		violations: readonly ViolationContract[],
		links: readonly TestTargetLink[],
		requested_count: number,
		batch_size: number,
	): AgentPackagePlan;
}

/** Responsibilities: _assignment feasibility result_. **/
export type AgentPackageAssignmentResult = {
	readonly feasible: boolean;
	readonly bins: readonly AgentPackageBinContract[];
};

/** Responsibilities: _assignment persistence behavior_. **/
export interface AgentPackageAssignmentStoreContract {
	previous_assignments(): AgentPackagePreviousAssignment[];
	write_manifest(staging_directory: string, plan: AgentPackagePlan): void;
}

/** Responsibilities: _agent package report rendering_. **/
export interface AgentTaskPackageMarkdownContract {
	package_markdown(agent_package: AgentWorkPackage, snapshot_id: string): string;
	snapshot_id(violations: readonly ViolationContract[]): string;
	summary_markdown(request: AgentPackageSummaryRequest): string;
}

/** Responsibilities: _agent package publication_. **/
export interface AgentTaskPackagePublicationContract {
	publish(request: AgentPackagePublicationRequest): AgentPackagePlan;
}

/** Responsibilities: _agent package publication input_. **/
export type AgentPackagePublicationRequest = {
	readonly selected_findings: readonly ViolationContract[];
	readonly snapshot_findings: readonly ViolationContract[];
	readonly test_target_links: readonly TestTargetLink[];
	readonly package_count: number;
	readonly batch_size: number;
	readonly deferred_findings: number;
	readonly suppressed_findings: number;
};

/** Responsibilities: _publication staging data_. **/
export type AgentPackagePublicationData = {
	readonly plan: AgentPackagePlan;
	readonly snapshot_id: string;
	readonly request: AgentPackagePublicationRequest;
};

/** Responsibilities: _package summary request_. **/
export type AgentPackageSummaryRequest = {
	readonly plan: AgentPackagePlan;
	readonly snapshot_id: string;
	readonly selected_findings: number;
	readonly deferred_findings: number;
	readonly suppressed_findings: number;
};

/** Responsibilities: _finding group and priority counts_. **/
export type AgentFindingUnit = {
	readonly files: readonly string[];
	readonly violations: readonly ViolationContract[];
	readonly counted_violations: readonly ViolationContract[];
	readonly counts_by_priority: ReadonlyMap<number, number>;
	readonly directories: readonly string[];
};

/** Responsibilities: _linked finding construction inputs_. **/
export type AgentPackageUnitBuildRequest = {
	readonly violations: readonly ViolationContract[];
	readonly links: readonly TestTargetLink[];
};

/** Responsibilities: _package assignment candidate_. **/
export type AgentPackageCandidate = {
	readonly package_number: number;
	readonly unit: AgentFindingUnit;
};

/** Responsibilities: _scored assignment candidate_. **/
export type AgentPackageScoredCandidate = {
	readonly bin: AgentPackageBinContract;
	readonly candidate: AgentPackageCandidate;
	readonly score: number;
};

/** Responsibilities: _assignment search state_. **/
export type AgentPackageAssignmentContext = {
	readonly units: readonly AgentFindingUnit[];
	readonly bins: AgentPackageBinContract[];
	readonly batch_size: number;
	readonly min_package_files: number;
	readonly target_file_count: number;
	readonly target_priorities: ReadonlyMap<number, number>;
	readonly preserve_ownership: boolean;
	readonly failed: Set<string>;
};

/** Responsibilities: _reversible package membership change_. **/
export type AgentPackageBinChange = {
	readonly unit: AgentFindingUnit;
	readonly adding: boolean;
};

/** Responsibilities: _plan materialization inputs_. **/
export type AgentPackagePlanRequest = {
	readonly requested_count: number;
	readonly batch_size: number;
	readonly unresolved_partition_constraints: number;
	readonly excluded_findings: readonly ViolationContract[];
};

/** Responsibilities: _package layout input_. **/
export type AgentPackagePlanLayoutRequest = {
	readonly bins: readonly AgentPackageBinContract[];
	readonly links: readonly TestTargetLink[];
};

/** Responsibilities: _path scope construction inputs_. **/
export type AgentPackagePathScopeRequest = {
	readonly package_number: number;
	readonly files: readonly string[];
	readonly owners_by_file: ReadonlyMap<string, number>;
};

/** Responsibilities: _package ownership index_. **/
export type AgentPackageFileOwners = ReadonlyMap<string, number>;

/** Responsibilities: _package path normalization input_. **/
export type AgentPackagePathSelection = {
	readonly files: ReadonlySet<string>;
	readonly links: readonly TestTargetLink[];
};

/** Responsibilities: _production and test package paths_. **/
export type AgentPackagePathKinds = {
	readonly production_paths: string[];
	readonly test_paths: string[];
};

/** Responsibilities: _work package construction inputs_. **/
export type AgentWorkPackageBuildRequest = {
	readonly bin: AgentPackageBinContract;
	readonly owners_by_file: AgentPackageFileOwners;
	readonly links: readonly TestTargetLink[];
};

/** Responsibilities: _planner request limits_. **/
export type AgentPackagePlanLimits = {
	readonly requested_count: number;
	readonly batch_size: number;
};

/** Responsibilities: _priority-ranked package input_. **/
export type AgentPackagePlanningRequest = {
	readonly violations: readonly ViolationContract[];
	readonly links: readonly TestTargetLink[];
	readonly limits: AgentPackagePlanLimits;
};

/** Responsibilities: _priority-ranked finding retention_. **/
export type AgentPackageRetentionRequest = {
	readonly production: readonly ViolationContract[];
	readonly tests: readonly ViolationContract[];
	readonly links: readonly TestTargetLink[];
	readonly limits: AgentPackagePlanLimits;
};

/** Responsibilities: _feasible finding selection_. **/
export type AgentPackagePartitionSelection = {
	readonly assignment: AgentPackageAssignmentResult;
	readonly excluded_findings: readonly ViolationContract[];
};

/** Responsibilities: _file-capacity selected units_. **/
export type AgentPackageRetainedUnitSelection = {
	readonly units: readonly AgentFindingUnit[];
	readonly excluded_findings: readonly ViolationContract[];
};

/** Responsibilities: _production and test finding groups_. **/
export type AgentPackageFindingGroups = {
	readonly production: readonly ViolationContract[];
	readonly tests: readonly ViolationContract[];
};

/** Responsibilities: _plan validation ownership records_. **/
export type AgentPackageValidationOwnership = {
	readonly findings: ReadonlyMap<string, number>;
	readonly files: ReadonlyMap<string, number>;
};

/** Responsibilities: _package file accounting inputs_. **/
export type AgentPackageFileRecordRequest = {
	readonly agent_package: AgentWorkPackage;
	readonly index: number;
	readonly files: Map<string, number>;
};

/** Responsibilities: _selected plan shape_. **/
export type AgentPackageSelectionValidation = {
	readonly plan: AgentPackagePlan;
	readonly selected_findings: readonly ViolationContract[];
};

/** Responsibilities: _package size validation inputs_. **/
export type AgentPackageSizeValidation = {
	readonly agent_package: AgentWorkPackage;
	readonly batch_size: number;
	readonly package_count: number;
};

/** Responsibilities: _package plan bounds_. **/
export type AgentPackageBoundsValidation = {
	readonly package_count: number;
	readonly requested_count: number;
	readonly unresolved_partition_constraints: number;
};

/** Responsibilities: _task file query_. **/
export type TaskFileSelectionRequest = {
	readonly mode: LintTaskPolicy;
	readonly violations: readonly ViolationContract[];
	readonly batch_size: number;
};
