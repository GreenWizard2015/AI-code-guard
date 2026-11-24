import { TEST_PATH_SUFFIXES } from "src/constants";
import { AgentPackageComponents } from "src/core/support/task/reporting/workspace/task_selection/assignment/ownership/agent_package_components";
import type { ViolationContract } from "src/reporting_protocols";
import type { TestPathSyntaxContract } from "src/shared_services_protocols";
import type {
	AgentFindingUnit,
	AgentFindingUnitCollectionContract,
	AgentPackageComponentsContract,
	AgentPackageHistoryContract,
	AgentPackageOwnershipContract,
	AgentPackageUnitBuildRequest,
} from "src/task_selection_types";
import { TestPathSyntax } from "src/test_path_syntax";
import { TestPathKind } from "src/types";

/** Responsibilities: _unit grouping_, _unit assignment order_. **/
export class AgentFindingUnitCollection implements AgentFindingUnitCollectionContract {
	private readonly _ownership: AgentPackageOwnershipContract;
	private readonly _history: AgentPackageHistoryContract;
	private readonly _test_path_syntax: TestPathSyntaxContract;

	/** Responsibilities: _file component index_. **/
	private component_index(request: AgentPackageUnitBuildRequest): AgentPackageComponentsContract {
		const components = new AgentPackageComponents();
		for (const violation of request.violations) {
			components.component(this._history.normalized_path(violation.file()));
		}
		for (const link of request.links) {
			const test_file = this._history.normalized_path(link.test_file);
			for (const production_file of link.production_files) {
				components.link(test_file, this._history.normalized_path(production_file));
			}
		}
		return components;
	}

	/** Responsibilities: _component violation map_. **/
	private group_violations(
		violations: readonly ViolationContract[],
		components: AgentPackageComponentsContract,
	): Map<string, ViolationContract[]> {
		const grouped = new Map<string, ViolationContract[]>();
		for (const violation of violations) {
			const file = this._history.normalized_path(violation.file());
			const component = components.component(file);
			let group = grouped.get(component);
			if (group === undefined) {
				group = [];
				grouped.set(component, group);
			}
			group.push(violation);
		}
		return grouped;
	}

	/** Responsibilities: _production violation selection_. **/
	private counted_violations(grouped_findings: readonly ViolationContract[]): ViolationContract[] {
		const counted: ViolationContract[] = [];
		for (const violation of grouped_findings) {
			if (this._test_path_syntax.classify(violation.file()).has(TestPathKind.TestFile)) {
				continue;
			}
			counted.push(violation);
		}
		return counted;
	}

	/** Responsibilities: _priority frequency table_. **/
	private priority_counts(counted_violations: readonly ViolationContract[]): Map<number, number> {
		const counts = new Map<number, number>();
		for (const violation of counted_violations) {
			const priority = violation.priority();
			counts.set(priority, (counts.get(priority) ?? 0) + 1);
		}
		return counts;
	}

	/** Responsibilities: _ordered component files_. **/
	private component_paths(paths: readonly string[]): string[] {
		const files: string[] = [];
		files.push(...paths);
		files.sort();
		return files;
	}

	/** Responsibilities: _violation unit construction_. **/
	private materialize_unit(
		violations: readonly ViolationContract[],
		component_members: readonly string[],
	): AgentFindingUnit {
		const files = this.component_paths(component_members);
		const counted_violations = this.counted_violations(violations);
		return {
			files,
			violations,
			counted_violations,
			counts_by_priority: this.priority_counts(counted_violations),
			directories: this.directories(files),
		};
	}

	/** Responsibilities: _violation unit collection_. **/
	private materialize_units(
		grouped_violations: ReadonlyMap<string, readonly ViolationContract[]>,
		components_by_root: ReadonlyMap<string, readonly string[]>,
	): AgentFindingUnit[] {
		const units: AgentFindingUnit[] = [];
		for (const [root, violations] of grouped_violations) {
			const component_members = components_by_root.get(root) ?? [];
			units.push(this.materialize_unit(violations, component_members));
		}
		return units;
	}

	/** Responsibilities: _ancestor directory paths_. **/
	private directories(files: readonly string[]): string[] {
		const directories = new Set<string>();
		for (const file of files) {
			const segments = file.split("/");
			for (let length = 2; length < segments.length; length += 1) {
				directories.add(segments.slice(0, length).join("/"));
			}
		}
		const ordered_directories = [...directories];
		ordered_directories.sort();
		return ordered_directories;
	}

	/** Responsibilities: _unit ordering dependencies_. **/
	public constructor(ownership: AgentPackageOwnershipContract, history: AgentPackageHistoryContract) {
		this._ownership = ownership;
		this._history = history;
		this._test_path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
	}

	/** Responsibilities: _unit order_. **/
	public stable_order(units: AgentFindingUnit[]): AgentFindingUnit[] {
		return units.sort((left, right) => this._ownership.compare_units(left, right));
	}

	/** Responsibilities: _component units_. **/
	public units(request: AgentPackageUnitBuildRequest): AgentFindingUnit[] {
		const components = this.component_index(request);
		const grouped_violations = this.group_violations(request.violations, components);
		return this.materialize_units(grouped_violations, components.groups());
	}
}
