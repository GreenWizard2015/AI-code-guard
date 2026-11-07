import { MIN_SHARED_METHODS } from "src/constants";
import type {
	CallableLocation,
	CandidateExtension,
	SharedCallableKind,
	SharedParameterCandidate,
	SharedParameterCandidateBranch,
	SharedParameterCandidateBranchOptions,
	SharedParameterCandidateExploration,
	SharedParameterCandidateExplorerContract,
	SharedParameterNode,
} from "src/metrics/types";

/** Responsibilities: _candidate branch expansion_, _maximal candidate selection_. **/
export class SharedParameterCandidateExplorer implements SharedParameterCandidateExplorerContract {
	private readonly _kind: SharedCallableKind;

	/** Responsibilities: _candidate branch queue addition_. **/
	private append_pending_branch(
		branches_by_key: Map<string, SharedParameterCandidateBranch>,
		branch: SharedParameterCandidateBranch,
	): void {
		const locations = branch.locations.map(
			(location) => `${location.file}\u0000${String(location.line)}\u0000${location.method}`,
		);
		const key = `${String(branch.next_index)}\u0001${locations.join("\u0002")}`;
		const existing = branches_by_key.get(key);
		if (existing === undefined) {
			branches_by_key.set(key, branch);
			return;
		}
		const merged_nodes = new Map(existing.nodes.map((node) => [node.key, node]));
		for (const node of branch.nodes) {
			merged_nodes.set(node.key, node);
		}
		branches_by_key.set(key, {
			next_index: branch.next_index,
			nodes: [...merged_nodes.values()],
			locations: branch.locations,
		});
	}

	/** Responsibilities: _candidate branch queue removal_. **/
	private take_pending_branch(
		branch_queue: Map<string, SharedParameterCandidateBranch>,
	): SharedParameterCandidateBranch {
		const entry = branch_queue.entries().next();
		if (entry.done) {
			throw new Error("Shared parameter candidate queue is unexpectedly empty.");
		}
		branch_queue.delete(entry.value[0]);
		return entry.value[1];
	}

	/** Responsibilities: _maximal candidate branch recording_. **/
	private append_candidate_branch(options: SharedParameterCandidateBranchOptions): boolean {
		const { branch, nodes, pending: candidate_queue, candidates, candidate_indexes } = options;
		const extended = this.append_candidate_extensions(branch, nodes, candidate_queue, candidate_indexes);
		if (extended) {
			return true;
		}
		if (branch.nodes.length <= 1) {
			return false;
		}
		const candidate_nodes = [...branch.nodes];
		candidate_nodes.sort((left, right) => this.compare_nodes(left, right));
		candidates.push({
			kind: this._kind,
			nodes: candidate_nodes,
			locations: branch.locations,
			support: branch.locations.length,
		});
		return false;
	}

	/** Responsibilities: _candidate branch extension_. **/
	private extend_candidate(options: CandidateExtension): boolean {
		const { branch, node, index, pending: candidate_queue } = options;
		const intersection = this.intersect_locations(branch.locations, node.locations);
		if (intersection.length < MIN_SHARED_METHODS) {
			return false;
		}
		this.append_pending_branch(candidate_queue, {
			next_index: index + 1,
			nodes: [...branch.nodes, node],
			locations: intersection,
		});
		return true;
	}

	/** Responsibilities: _candidate branch extension_. **/
	private append_candidate_extensions(
		branch: SharedParameterCandidateBranch,
		nodes: readonly SharedParameterNode[],
		branches_to_extend: Map<string, SharedParameterCandidateBranch>,
		candidate_indexes: readonly number[],
	): boolean {
		let extended = false;
		for (const index of candidate_indexes) {
			if (index < branch.next_index) {
				continue;
			}
			const node = nodes[index];
			if (node === undefined) {
				continue;
			}
			extended = this.extend_candidate({ branch, node, index, pending: branches_to_extend }) || extended;
		}
		return extended;
	}

	/** Responsibilities: _shared parameter text ordering_. **/
	private compare_text(left: string, right: string): number {
		if (left < right) {
			return -1;
		}
		if (left > right) {
			return 1;
		}
		return 0;
	}

	/** Responsibilities: _candidate explorer initialization_. **/
	public constructor(kind: SharedCallableKind) {
		this._kind = kind;
	}

	/** Responsibilities: _maximal candidate collection_. **/
	public append_maximal_candidates(options: SharedParameterCandidateExploration): void {
		const { nodes, next_index, selected, locations, candidates, candidate_indexes } = options;
		const pending = new Map<string, SharedParameterCandidateBranch>();
		this.append_pending_branch(pending, { next_index, nodes: selected, locations });
		while (pending.size > 0) {
			const branch = this.take_pending_branch(pending);
			if (branch === undefined) {
				continue;
			}
			this.append_candidate_branch({
				branch,
				nodes,
				pending,
				candidates,
				candidate_indexes,
			});
		}
	}

	/** Responsibilities: _shared parameter location ordering_. **/
	public compare_locations(left: CallableLocation, right: CallableLocation): number {
		const file_order = this.compare_text(left.file, right.file);
		if (file_order !== 0) {
			return file_order;
		}
		if (left.line !== right.line) {
			return left.line - right.line;
		}
		return this.compare_text(left.method, right.method);
	}

	/** Responsibilities: _shared source location intersection_. **/
	public intersect_locations(
		left: readonly CallableLocation[],
		right: readonly CallableLocation[],
	): CallableLocation[] {
		const intersection: CallableLocation[] = [];
		let right_index = 0;
		for (const location of left) {
			let right_location = right[right_index];
			while (right_location !== undefined && this.compare_locations(right_location, location) < 0) {
				right_index += 1;
				right_location = right[right_index];
			}
			if (right_location === undefined) {
				break;
			}
			if (this.compare_locations(location, right_location) === 0) {
				intersection.push(location);
			}
		}
		return intersection;
	}

	/** Responsibilities: _shared parameter node ordering_. **/
	public compare_nodes(left: SharedParameterNode, right: SharedParameterNode): number {
		if (left.identity < right.identity) {
			return -1;
		}
		if (left.identity > right.identity) {
			return 1;
		}
		return 0;
	}

	/** Responsibilities: _shared parameter candidate ordering_. **/
	public compare_candidates(left: SharedParameterCandidate, right: SharedParameterCandidate): number {
		if (left.nodes.length !== right.nodes.length) {
			return left.nodes.length - right.nodes.length;
		}
		for (let index = 0; index < left.nodes.length; index += 1) {
			const left_node = left.nodes[index];
			const right_node = right.nodes[index];
			if (left_node === undefined || right_node === undefined) {
				throw new Error("Shared parameter candidates have inconsistent node counts.");
			}
			const order = this.compare_nodes(left_node, right_node);
			if (order !== 0) {
				return order;
			}
		}
		return 0;
	}
}
