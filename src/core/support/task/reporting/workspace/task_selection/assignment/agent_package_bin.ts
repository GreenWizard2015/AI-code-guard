import type {
	AgentFindingUnit,
	AgentPackageBinChange,
	AgentPackageBinContract,
	AgentPackageBinEvaluation,
	AgentPackageBinEvaluationRequest,
} from "src/task_selection_types";

/** Responsibilities: _package membership_, _priority distribution_, _file capacity_. **/
export class AgentPackageBin implements AgentPackageBinContract {
	private readonly _number: number;
	private readonly _units: AgentFindingUnit[];
	private readonly _counts_by_priority: Map<number, number>;

	/** Responsibilities: _priority count changes_. **/
	private update_priority_counts(change: AgentPackageBinChange): void {
		for (const [priority, count] of change.unit.counts_by_priority) {
			const current_count = this._counts_by_priority.get(priority) ?? 0;
			let next_count = current_count;
			if (change.adding) {
				next_count += count;
			} else {
				next_count -= count;
			}
			if (next_count === 0) {
				this._counts_by_priority.delete(priority);
			} else {
				this._counts_by_priority.set(priority, next_count);
			}
		}
	}

	/** Responsibilities: _package file distribution_. **/
	private file_balance_score(package_number: number, target_count: number, additional_count: number): number {
		let next_count = this.file_count();
		if (package_number === this._number) {
			next_count += additional_count;
		}
		return ((next_count - target_count) / Math.max(1, target_count)) ** 2;
	}

	/** Responsibilities: _new package files_. **/
	private additional_file_count(unit: AgentFindingUnit): number {
		const existing_files = new Set<string>();
		for (const assigned_unit of this._units) {
			for (const file of assigned_unit.files) {
				existing_files.add(file);
			}
		}
		let additional = 0;
		for (const file of unit.files) {
			if (!existing_files.has(file)) {
				additional += 1;
				existing_files.add(file);
			}
		}
		return additional;
	}

	/** Responsibilities: _priority distribution_. **/
	private priority_balance_score(
		package_number: number,
		unit_priorities: ReadonlyMap<number, number>,
		target_priorities: ReadonlyMap<number, number>,
	): number {
		let score = 0;
		for (const [priority, target] of target_priorities) {
			let priority_count = this._counts_by_priority.get(priority) ?? 0;
			if (package_number === this._number) {
				priority_count += unit_priorities.get(priority) ?? 0;
			}
			score += ((priority_count - target) / Math.max(1, target)) ** 2;
		}
		return score;
	}

	/** Responsibilities: _package-bin initialization_. **/
	public constructor(package_number: number) {
		this._number = package_number;
		this._units = [];
		this._counts_by_priority = new Map();
	}

	/** Responsibilities: _package number access_. **/
	public package_number(): number {
		return this._number;
	}

	/** Responsibilities: _assigned units access_. **/
	public units(): readonly AgentFindingUnit[] {
		const units: AgentFindingUnit[] = [];
		for (const unit of this._units) {
			units.push(unit);
		}
		return units;
	}

	/** Responsibilities: _production findings total_. **/
	public finding_count(): number {
		let total = 0;
		for (const unit of this._units) {
			total += unit.counted_violations.length;
		}
		return total;
	}

	/** Responsibilities: _assigned file count_. **/
	public file_count(): number {
		const files = new Set<string>();
		for (const unit of this._units) {
			for (const file of unit.files) {
				files.add(file);
			}
		}
		return files.size;
	}

	/** Responsibilities: _search state signature_. **/
	public signature(): string {
		const priorities = [...this._counts_by_priority.entries()];
		priorities.sort(([left], [right]) => left - right);
		const signature_parts = priorities.map(([priority, count]) => `${priority}=${count}`);
		return `${this.file_count()}/${this.finding_count()}[${signature_parts.join(",")}]`;
	}

	/** Responsibilities: _candidate balance scoring_. **/
	public evaluate(request: AgentPackageBinEvaluationRequest): AgentPackageBinEvaluation {
		const incoming_file_count = this.additional_file_count(request.unit);
		const within_capacity = this.file_count() + incoming_file_count <= request.batch_size;
		const file_score = this.file_balance_score(request.package_number, request.target_file_count, incoming_file_count);
		const priority_score = this.priority_balance_score(
			request.package_number,
			request.unit.counts_by_priority,
			request.target_priorities,
		);
		return { within_capacity, balance_score: file_score + priority_score };
	}

	/** Responsibilities: _package-bin reversible update_. **/
	public apply_change(change: AgentPackageBinChange): void {
		if (change.adding) {
			this._units.push(change.unit);
		} else {
			this._units.pop();
		}
		this.update_priority_counts(change);
	}
}
