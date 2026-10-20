import { MIN_ARGUMENT_USES, MIN_SHARED_METHODS } from "src/constants";
import { SharedParameterCandidateExplorer } from "src/metrics/shared_parameter_candidate_explorer";
import { SharedParameterNeighborIndex } from "src/metrics/shared_parameter_neighbor_index";
import { SharedParameterOrder } from "src/metrics/shared_parameter_order";
import type {
	AnalyzedCallable,
	AnalyzedParameter,
	CallableLocation,
	SharedCallableKind,
	SharedParameterCandidate,
	SharedParameterCandidateExplorerContract,
	SharedParameterNeighborIndexContract,
	SharedParameterNode,
	SharedParameterOrderContract,
} from "src/metrics/types";

import { SHARED_PARAMETER_REFERENCE_KIND } from "src/metrics/constants";
import type { MutableParameterNode } from "src/metrics/types";

/** Responsibilities: _callable parameter grouping_, _shared candidate reduction_. **/
export class SharedParameterAnalyzer {
	private readonly callables: readonly AnalyzedCallable[];
	private readonly kind: SharedCallableKind;
	private readonly has_kind: boolean;
	private readonly valid_scope: boolean;
	private readonly candidate_explorer: SharedParameterCandidateExplorerContract;
	private readonly neighbor_index: SharedParameterNeighborIndexContract;

	/** Responsibilities: _parameter shared-parameter grouping addition_. **/
	private append_parameter(
		nodes: Map<string, MutableParameterNode>,
		parameter: AnalyzedParameter,
		location: CallableLocation,
	): void {
		let node = nodes.get(parameter.key);
		if (node === undefined) {
			node = {
				key: parameter.key,
				identity: parameter.identity,
				kind: parameter.kind,
				project_type: parameter.project_type,
				locations: new Map<string, CallableLocation>(),
			};
			nodes.set(parameter.key, node);
		}
		const key = JSON.stringify([location.file, location.line, location.method]);
		node.locations.set(key, location);
	}

	/** Responsibilities: _aggregation supported parameters analysis_. **/
	private append_callable(nodes: Map<string, MutableParameterNode>, callable: AnalyzedCallable): void {
		const parameter_keys = new Set<string>();
		for (const parameter of callable.parameters) {
			if (parameter.uses < MIN_ARGUMENT_USES) {
				continue;
			}
			if (parameter_keys.has(parameter.key)) {
				continue;
			}
			parameter_keys.add(parameter.key);
			this.append_parameter(nodes, parameter, callable.location);
		}
	}

	/** Responsibilities: _mutable parameter analysis conversion_. **/
	private immutable_node(node: MutableParameterNode): SharedParameterNode {
		const shared_parameter_order = new SharedParameterOrder();

		const locations = [...node.locations.values()];
		locations.sort((left, right) => shared_parameter_order.compare_locations(left, right));
		return {
			key: node.key,
			identity: node.identity,
			kind: node.kind,
			project_type: node.project_type,
			locations,
		};
	}

	/** Responsibilities: _candidate location equality_. **/
	private same_candidate_locations(
		left: SharedParameterCandidate,
		right: SharedParameterCandidate,
		order: SharedParameterOrderContract,
	): boolean {
		if (left.locations.length !== right.locations.length) {
			return false;
		}
		return left.locations.every((location, index) => order.compare_locations(location, right.locations[index]) === 0);
	}

	/** Responsibilities: _candidate location buckets_. **/
	private candidates_by_location(
		candidates: readonly SharedParameterCandidate[],
	): Map<string, SharedParameterCandidate[]> {
		const buckets = new Map<string, SharedParameterCandidate[]>();
		for (const candidate of candidates) {
			const key = candidate.locations.map((location) => JSON.stringify(location)).join("\u0000");
			let bucket = buckets.get(key);
			if (bucket === undefined) {
				bucket = [];
				buckets.set(key, bucket);
			}
			bucket.push(candidate);
		}
		return buckets;
	}

	/** Responsibilities: _candidate redundancy_. **/
	private candidate_is_redundant(
		candidate: SharedParameterCandidate,
		container: SharedParameterCandidate,
		order: SharedParameterOrderContract,
	): boolean {
		if (container === candidate || container.nodes.length <= candidate.nodes.length) {
			return false;
		}
		const container_keys = new Set(container.nodes.map((node) => node.key));
		if (!candidate.nodes.every((node) => container_keys.has(node.key))) {
			return false;
		}
		return this.same_candidate_locations(container, candidate, order);
	}

	/** Responsibilities: _compaction candidates by support_. **/
	private compact_candidates(candidates: readonly SharedParameterCandidate[]): SharedParameterCandidate[] {
		const shared_parameter_order = new SharedParameterOrder();
		const candidates_by_location = this.candidates_by_location(candidates);
		return candidates.filter((candidate) => {
			if (candidate.nodes.length === 1) {
				return true;
			}
			const key = candidate.locations.map((location) => JSON.stringify(location)).join("\u0000");
			let bucket = candidates_by_location.get(key);
			if (bucket === undefined) {
				bucket = [];
			}
			return !bucket.some((container) => this.candidate_is_redundant(candidate, container, shared_parameter_order));
		});
	}

	/** Responsibilities: _candidate root collection_. **/
	private root_candidates(
		nodes: readonly SharedParameterNode[],
		neighbors: SharedParameterNeighborIndexContract,
	): SharedParameterCandidate[] {
		const candidates: SharedParameterCandidate[] = [];
		for (let index = 0; index < nodes.length; index += 1) {
			const node = nodes[index];
			if (node.kind !== SHARED_PARAMETER_REFERENCE_KIND) {
				continue;
			}
			candidates.push({ kind: this.kind, nodes: [node], locations: node.locations, support: node.locations.length });
			this.candidate_explorer.append_maximal_candidates({
				nodes,
				next_index: index + 1,
				selected: [node],
				locations: node.locations,
				candidates,
				candidate_indexes: neighbors.for_root(index),
			});
		}
		return candidates;
	}

	/** Responsibilities: _candidate identity deduplication_. **/
	private unique_candidates(candidates: readonly SharedParameterCandidate[]): SharedParameterCandidate[] {
		const unique = new Map<string, SharedParameterCandidate>();
		for (const candidate of candidates) {
			const key = candidate.nodes.map((node) => node.key).join("\u0000");
			unique.set(key, candidate);
		}
		return [...unique.values()];
	}

	/** Responsibilities: _initialization analyzer normalization callable_. **/
	public constructor(callables: readonly AnalyzedCallable[]) {
		this.callables = callables;
		const first_callable = callables[0];
		this.has_kind = first_callable !== undefined;
		this.kind = "method";
		if (first_callable !== undefined) {
			this.kind = first_callable.kind;
		}
		this.candidate_explorer = new SharedParameterCandidateExplorer(this.kind);
		this.neighbor_index = new SharedParameterNeighborIndex(new Map());
		this.valid_scope = true;
		if (this.has_kind) {
			this.valid_scope = callables.every((callable) => callable.kind === this.kind);
		}
	}

	/** Responsibilities: _output immutable shared-parameter groups_. **/
	public shared_parameters(): ReadonlyMap<string, SharedParameterNode> {
		if (!this.valid_scope) {
			return new Map();
		}
		const shared_parameter_order = new SharedParameterOrder();

		const mutable_nodes = new Map<string, MutableParameterNode>();
		for (const callable of this.callables) {
			this.append_callable(mutable_nodes, callable);
		}
		const mutable_node_values = [...mutable_nodes.values()];
		const nodes = mutable_node_values.map((node) => this.immutable_node(node));
		nodes.sort((left, right) => shared_parameter_order.compare_nodes(left, right));
		return new Map(nodes.map((node) => [node.key, node]));
	}

	/** Responsibilities: _collection shared parameters satisfy_. **/
	public collect_candidates(): SharedParameterCandidate[] {
		const shared_parameter_order = new SharedParameterOrder();

		const shared_parameter_values = [...this.shared_parameters().values()];
		const nodes = shared_parameter_values.filter((node) => node.locations.length >= MIN_SHARED_METHODS);
		const neighbor_index = this.neighbor_index.with_nodes(nodes);
		const result = this.compact_candidates(this.unique_candidates(this.root_candidates(nodes, neighbor_index)));
		result.sort((left, right) => shared_parameter_order.compare_candidates(left, right));
		return result;
	}
}
