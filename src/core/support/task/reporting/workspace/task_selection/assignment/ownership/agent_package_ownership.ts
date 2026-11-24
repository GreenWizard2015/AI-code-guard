import type {
	AgentFindingUnit,
	AgentPackageCandidate,
	AgentPackageHistoryContract,
	AgentPackageOwnershipContract,
} from "src/task_selection_types";

/** Responsibilities: _previous package ownership_, _stable package allocation_. **/
export class AgentPackageOwnership implements AgentPackageOwnershipContract {
	private readonly _history: AgentPackageHistoryContract;
	private readonly _retention_weight = 1_000_000_000;

	/** Responsibilities: _unit content ordering_. **/
	private compare_unit_content(left: AgentFindingUnit, right: AgentFindingUnit): number {
		const size_difference = right.files.length - left.files.length;
		if (size_difference !== 0) {
			return size_difference;
		}
		const priority_difference =
			this.highest_priority(right.counts_by_priority) - this.highest_priority(left.counts_by_priority);
		if (priority_difference !== 0) {
			return priority_difference;
		}
		const left_file = left.files[0] ?? "";
		const right_file = right.files[0] ?? "";
		return left_file.localeCompare(right_file);
	}

	/** Responsibilities: _highest package priority_. **/
	private highest_priority(priorities: ReadonlyMap<number, number>): number {
		let highest = -1;
		for (const priority of priorities.keys()) {
			highest = Math.max(highest, priority);
		}
		return highest;
	}

	/** Responsibilities: _active ownership counts_. **/
	private active_package_counts(units: readonly AgentFindingUnit[], requested_count: number): Map<number, number> {
		const active_counts = new Map<number, number>();
		for (const unit of units) {
			const package_number = this.owner_for_unit(unit);
			if (package_number < 1) {
				continue;
			}
			if (package_number <= requested_count) {
				const next_count = (active_counts.get(package_number) ?? 0) + unit.files.length;
				active_counts.set(package_number, next_count);
			}
		}
		return active_counts;
	}

	/** Responsibilities: _package number ranking_. **/
	private ranked_package_numbers(active_counts: ReadonlyMap<number, number>, package_count: number): number[] {
		const ranked_owners = [...active_counts.entries()];
		ranked_owners.sort(([left_package, left_count], [right_package, right_count]) => {
			const count_difference = right_count - left_count;
			if (count_difference !== 0) {
				return count_difference;
			}
			return left_package - right_package;
		});
		return ranked_owners.slice(0, package_count).map(([package_number]) => package_number);
	}

	/** Responsibilities: _file ownership vote counts_. **/
	private file_owner_counts(unit: AgentFindingUnit): Map<number, number> {
		const counts = new Map<number, number>();
		for (const file of unit.files) {
			const package_number = this._history.owner_for_file(file);
			if (package_number < 1) {
				continue;
			}
			counts.set(package_number, (counts.get(package_number) ?? 0) + 1);
		}
		return counts;
	}

	/** Responsibilities: _highest ownership vote_. **/
	private highest_owner(counts: ReadonlyMap<number, number>): number {
		let best_package_number = 0;
		let best_count = 0;
		for (const [package_number, count] of counts) {
			const has_better_claim = count > best_count;
			const tied_but_earlier = count === best_count && package_number < best_package_number;
			if (has_better_claim || tied_but_earlier) {
				best_package_number = package_number;
				best_count = count;
			}
		}
		return best_package_number;
	}

	/** Responsibilities: _package owner ordering_. **/
	private owner_order(left: number, right: number): number {
		if (left === right) {
			return 0;
		}
		const left_assigned = left > 0;
		const right_assigned = right > 0;
		if (left_assigned && !right_assigned) {
			return -1;
		}
		if (!left_assigned && right_assigned) {
			return 1;
		}
		if (left_assigned && right_assigned) {
			return left - right;
		}
		return 0;
	}

	/** Responsibilities: _package ownership initialization_. **/
	public constructor(history: AgentPackageHistoryContract) {
		this._history = history;
	}

	/** Responsibilities: _unit ownership vote_. **/
	public owner_for_unit(unit: AgentFindingUnit): number {
		const counts = this.file_owner_counts(unit);
		return this.highest_owner(counts);
	}

	/** Responsibilities: _unit assignment ordering_. **/
	public compare_units(left: AgentFindingUnit, right: AgentFindingUnit): number {
		const left_owner = this.owner_for_unit(left);
		const right_owner = this.owner_for_unit(right);
		const package_order = this.owner_order(left_owner, right_owner);
		if (package_order !== 0) {
			return package_order;
		}
		return this.compare_unit_content(left, right);
	}

	/** Responsibilities: _retained path scoring_. **/
	public retention_score(candidate: AgentPackageCandidate): number {
		let score = 0;
		for (const file of candidate.unit.files) {
			const package_number = this._history.owner_for_file(file);
			if (package_number < 1) {
				continue;
			}
			if (package_number !== candidate.package_number) {
				score += this._retention_weight;
			}
		}
		return score;
	}

	/** Responsibilities: _active package number selection_. **/
	public package_numbers(units: readonly AgentFindingUnit[], package_count: number, requested_count: number): number[] {
		const active_counts = this.active_package_counts(units, requested_count);
		const numbers = this.ranked_package_numbers(active_counts, package_count);
		for (
			let package_number = 1;
			package_number <= requested_count && numbers.length < package_count;
			package_number += 1
		) {
			if (!numbers.includes(package_number)) {
				numbers.push(package_number);
			}
		}
		numbers.sort((left, right) => left - right);
		return numbers;
	}
}
