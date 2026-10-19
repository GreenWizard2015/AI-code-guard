import { SharedParameterOrder } from "src/core/support/shared_parameter_order";
import { MIN_SHARED_METHODS } from "src/constants";
import type {
	CandidateExtension,
	SharedCallableKind,
	SharedParameterCandidateBranchOptions,
	SharedParameterCandidateBranch,
	SharedParameterCandidateExplorerContract,
	SharedParameterCandidateExploration,
	SharedParameterNode,
	SharedParameterOrderContract,
} from "src/metrics/types";

/** Responsibilities: _candidate branch expansion_, _maximal candidate selection_. **/
export class SharedParameterCandidateExplorer implements SharedParameterCandidateExplorerContract {
	private readonly kind: SharedCallableKind;

	/** Responsibilities: _candidate branch queue addition_. **/
	private append_pending_branch(
		pending: Map<string, SharedParameterCandidateBranch>,
		branch: SharedParameterCandidateBranch,
	): void {
		const locations = branch.locations.map(
			(location) => `${location.file}\u0000${String(location.line)}\u0000${location.method}`,
		);
		const key = `${String(branch.next_index)}\u0001${locations.join("\u0002")}`;
		const existing = pending.get(key);
		if (existing === undefined) {
			pending.set(key, branch);
			return;
		}
		const merged_nodes = new Map(existing.nodes.map((node) => [node.key, node]));
		for (const node of branch.nodes) {
			merged_nodes.set(node.key, node);
		}
		pending.set(key, {
			next_index: branch.next_index,
			nodes: [...merged_nodes.values()],
			locations: branch.locations,
		});
	}

	/** Responsibilities: _candidate branch queue removal_. **/
	private take_pending_branch(pending: Map<string, SharedParameterCandidateBranch>): SharedParameterCandidateBranch {
		const entry = pending.entries().next();
		if (entry.done) {
			throw new Error("Shared parameter candidate queue is unexpectedly empty.");
		}
		pending.delete(entry.value[0]);
		return entry.value[1];
	}

	/** Responsibilities: _maximal candidate branch recording_. **/
	private append_candidate_branch(options: SharedParameterCandidateBranchOptions): boolean {
		const { branch, nodes, order, pending, candidates, candidate_indexes } = options;
		const extended = this.append_candidate_extensions(branch, nodes, order, pending, candidate_indexes);
		if (extended) {
			return true;
		}
		if (branch.nodes.length <= 1) {
			return false;
		}
		const candidate_nodes = [...branch.nodes];
		candidate_nodes.sort((left, right) => order.compare_nodes(left, right));
		candidates.push({
			kind: this.kind,
			nodes: candidate_nodes,
			locations: branch.locations,
			support: branch.locations.length,
		});
		return false;
	}

	/** Responsibilities: _candidate branch extension_. **/
	private extend_candidate(options: CandidateExtension): boolean {
		const { branch, node, index, order, pending } = options;
		const intersection = order.intersect_locations(branch.locations, node.locations);
		if (intersection.length < MIN_SHARED_METHODS) {
			return false;
		}
		this.append_pending_branch(
			pending,
			{ next_index: index + 1, nodes: [...branch.nodes, node], locations: intersection },
		);
		return true;
	}

	/** Responsibilities: _candidate explorer initialization_. **/
	public constructor(kind: SharedCallableKind) {
		this.kind = kind;
	}

	/** Responsibilities: _candidate branch extension_. **/
	public append_candidate_extensions(
		branch: SharedParameterCandidateBranch,
		nodes: readonly SharedParameterNode[],
		order: SharedParameterOrderContract,
		pending: Map<string, SharedParameterCandidateBranch>,
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
			extended = this.extend_candidate({ branch, node, index, order, pending }) || extended;
		}
		return extended;
	}

	/** Responsibilities: _maximal candidate collection_. **/
	public append_maximal_candidates(options: SharedParameterCandidateExploration): void {
		const { nodes, next_index, selected, locations, candidates, candidate_indexes } = options;
		const shared_parameter_order = new SharedParameterOrder();
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
				order: shared_parameter_order,
				pending,
				candidates,
				candidate_indexes,
			});
		}
	}
}
