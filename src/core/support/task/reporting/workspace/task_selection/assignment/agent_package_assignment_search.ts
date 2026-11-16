import { EMPTY_ASSIGNMENT_MESSAGE } from "src/core/support/task/reporting/workspace/task_selection/constants";
import type {
	AgentFindingUnit,
	AgentPackageAssignmentContext,
	AgentPackageAssignmentResult,
	AgentPackageBinContract,
	AgentPackageCandidate,
	AgentPackageOwnershipContract,
	AgentPackageScoredCandidate,
} from "src/task_selection_types";

/** Responsibilities: _capacity-constrained assignment search_, _package state tracking_. **/
export class AgentPackageAssignmentSearch {
	private readonly _context: AgentPackageAssignmentContext;
	private readonly _ownership: AgentPackageOwnershipContract;

	/** Responsibilities: _minimum package capacity requirement_. **/
	private minimum_capacity_needed(): number {
		let minimum_needed = 0;
		for (const bin of this._context.bins) {
			const deficit = this._context.min_package_files - bin.file_count();
			minimum_needed += Math.max(0, deficit);
		}
		return minimum_needed;
	}

	/** Responsibilities: _remaining package capacity_. **/
	private available_capacity(): number {
		let available = 0;
		for (const bin of this._context.bins) {
			available += this._context.batch_size - bin.file_count();
		}
		return available;
	}

	/** Responsibilities: _candidate balance score_. **/
	private balance_score(candidate: AgentPackageCandidate): number {
		return this._context.bins.reduce((total, bin) => {
			const evaluation = bin.evaluate({
				package_number: candidate.package_number,
				unit: candidate.unit,
				batch_size: this._context.batch_size,
				target_file_count: this._context.target_file_count,
				target_priorities: this._context.target_priorities,
			});
			return total + evaluation.balance_score;
		}, 0);
	}

	/** Responsibilities: _package directory membership_. **/
	private contains_directory(bin: AgentPackageBinContract, directory: string): boolean {
		for (const unit of bin.units()) {
			if (unit.directories.includes(directory)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _directory ownership conflicts_. **/
	private splits_directory(candidate_bin: AgentPackageBinContract, directory: string): boolean {
		if (this.contains_directory(candidate_bin, directory)) {
			return false;
		}
		for (const bin of this._context.bins) {
			if (this.contains_directory(bin, directory)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _directory affinity score_. **/
	private directory_affinity_score(directories: readonly string[], candidate_bin: AgentPackageBinContract): number {
		let score = 0;
		for (const directory of directories) {
			if (this.splits_directory(candidate_bin, directory)) {
				score += 1;
			}
		}
		return score;
	}

	/** Responsibilities: _candidate placement score_. **/
	private scored_candidate(
		candidate: AgentPackageCandidate,
		bin: AgentPackageBinContract,
	): AgentPackageScoredCandidate {
		const retention = this._ownership.retention_score(candidate);
		const balance = this.balance_score(candidate);
		const directory = this.directory_affinity_score(candidate.unit.directories, bin);
		return { bin, candidate, score: retention + balance + directory };
	}

	/** Responsibilities: _candidate score ordering_. **/
	private candidate_order(left: AgentPackageScoredCandidate, right: AgentPackageScoredCandidate): number {
		const score_difference = left.score - right.score;
		if (score_difference !== 0) {
			return score_difference;
		}
		return left.bin.package_number() - right.bin.package_number();
	}

	/** Responsibilities: _capacity-valid candidate ordering_. **/
	private candidate_bins(unit: AgentFindingUnit): AgentPackageScoredCandidate[] {
		const candidates: AgentPackageScoredCandidate[] = [];
		for (const bin of this._context.bins) {
			const candidate: AgentPackageCandidate = { package_number: bin.package_number(), unit };
			const evaluation = bin.evaluate({
				package_number: bin.package_number(),
				unit,
				batch_size: this._context.batch_size,
				target_file_count: this._context.target_file_count,
				target_priorities: this._context.target_priorities,
			});
			if (evaluation.within_capacity) {
				candidates.push(this.scored_candidate(candidate, bin));
			}
		}
		candidates.sort((left, right) => this.candidate_order(left, right));
		return candidates;
	}

	/** Responsibilities: _recursive candidate placement_. **/
	private try_candidate_bins(position: number, remaining: number, unit: AgentFindingUnit): boolean {
		const attempted = new Set<string>();
		for (const candidate of this.candidate_bins(unit)) {
			const signature = candidate.bin.signature();
			if (!this._context.preserve_ownership && attempted.has(signature)) {
				continue;
			}
			attempted.add(signature);
			candidate.bin.apply_change({ unit, adding: true });
			if (this.search_assignment(position + 1, remaining - unit.files.length)) {
				return true;
			}
			candidate.bin.apply_change({ unit, adding: false });
		}
		return false;
	}

	/** Responsibilities: _complete package capacity check_. **/
	private assignment_complete(): boolean {
		return this._context.bins.every((bin) => {
			const count = bin.file_count();
			return count >= this._context.min_package_files && count <= this._context.batch_size;
		});
	}

	/** Responsibilities: _search state fingerprint_. **/
	private search_state_key(index: number): string {
		const signatures = this._context.bins.map((bin) => `${bin.package_number()}:${bin.signature()}`);
		signatures.sort();
		return `${index}:${signatures.join("|")}`;
	}

	/** Responsibilities: _assignment search recursion_. **/
	private search_assignment(index: number, remaining: number): boolean {
		if (!this.remaining_capacity_feasible(remaining)) {
			return false;
		}
		if (index === this._context.units.length) {
			return this.assignment_complete();
		}
		const state = this.search_state_key(index);
		if (this._context.failed.has(state)) {
			return false;
		}
		const unit = this._context.units[index];
		if (unit !== undefined && this.try_candidate_bins(index, remaining, unit)) {
			return true;
		}
		this._context.failed.add(state);
		return false;
	}

	/** Responsibilities: _search state initialization_. **/
	public constructor(context: AgentPackageAssignmentContext, ownership: AgentPackageOwnershipContract) {
		if (context.bins.length === 0) {
			throw new Error(EMPTY_ASSIGNMENT_MESSAGE);
		}
		this._ownership = ownership;
		this._context = context;
	}

	/** Responsibilities: _remaining capacity feasibility_. **/
	public remaining_capacity_feasible(remaining_files: number): boolean {
		const minimum_needed = this.minimum_capacity_needed();
		const available = this.available_capacity();
		return remaining_files >= minimum_needed && remaining_files <= available;
	}

	/** Responsibilities: _assignment result_. **/
	public assign(): AgentPackageAssignmentResult {
		let total_files = 0;
		for (const unit of this._context.units) {
			total_files += unit.files.length;
		}
		if (!this.remaining_capacity_feasible(total_files)) {
			return { feasible: false, bins: [] };
		}
		const feasible = this.search_assignment(0, total_files);
		return { feasible, bins: this._context.bins };
	}
}
