import { MIN_ARGUMENT_USES, MIN_SHARED_METHODS } from "src/constants";
import { SharedParameterCandidateExplorer } from "src/metrics/shared_parameter/shared_parameter_candidate_explorer";
import { SharedParameterNeighborIndex } from "src/metrics/shared_parameter/shared_parameter_neighbor_index";
import type {
	AnalyzedCallable,
	AnalyzedParameter,
	CallableLocation,
	SharedCallableKind,
	SharedParameterCandidate,
	SharedParameterCandidateExplorerContract,
	SharedParameterNeighborIndexContract,
	SharedParameterNode,
} from "src/metrics/types";

import type { MutableParameterNode } from "src/metrics/types";

/** Responsibilities: _callable parameter grouping_, _shared candidate reduction_. **/
export class SharedParameterAnalyzer {
	private readonly _callables: readonly AnalyzedCallable[];
	private readonly _kind: SharedCallableKind;
	private readonly _has_kind: boolean;
	private readonly _valid_scope: boolean;
	private readonly _candidate_explorer: SharedParameterCandidateExplorerContract;
	private readonly _neighbor_index: SharedParameterNeighborIndexContract;

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
				primitive: parameter.primitive,
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
		const locations = [...node.locations.values()];
		locations.sort((left, right) => this._candidate_explorer.compare_locations(left, right));
		return {
			key: node.key,
			identity: node.identity,
			kind: node.kind,
			primitive: node.primitive,
			project_type: node.project_type,
			locations,
		};
	}

	/** Responsibilities: _candidate location equality_. **/
	private same_candidate_locations(left: SharedParameterCandidate, right: SharedParameterCandidate): boolean {
		if (left.locations.length !== right.locations.length) {
			return false;
		}
		return left.locations.every((location, index) => {
			const matching_location = right.locations[index];
			if (matching_location === undefined) {
				return false;
			}
			return this._candidate_explorer.compare_locations(location, matching_location) === 0;
		});
	}

	/** Responsibilities: _candidate location buckets_. **/
	private candidates_by_location(
		candidate_values: readonly SharedParameterCandidate[],
	): Map<string, SharedParameterCandidate[]> {
		const buckets = new Map<string, SharedParameterCandidate[]>();
		for (const candidate of candidate_values) {
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
	private candidate_is_redundant(candidate: SharedParameterCandidate, container: SharedParameterCandidate): boolean {
		if (container === candidate || container.nodes.length <= candidate.nodes.length) {
			return false;
		}
		const container_keys = new Set(container.nodes.map((node) => node.key));
		if (!candidate.nodes.every((node) => container_keys.has(node.key))) {
			return false;
		}
		return this.same_candidate_locations(container, candidate);
	}

	/** Responsibilities: _compaction candidates by support_. **/
	private compact_candidates(candidates_to_compact: readonly SharedParameterCandidate[]): SharedParameterCandidate[] {
		const candidates_by_location = this.candidates_by_location(candidates_to_compact);
		return candidates_to_compact.filter((candidate) => {
			if (candidate.nodes.length === 1) {
				return true;
			}
			const key = candidate.locations.map((location) => JSON.stringify(location)).join("\u0000");
			let bucket = candidates_by_location.get(key);
			if (bucket === undefined) {
				bucket = [];
			}
			return !bucket.some((container) => this.candidate_is_redundant(candidate, container));
		});
	}

	/** Responsibilities: _candidate root collection_. **/
	private root_candidates(
		nodes: readonly SharedParameterNode[],
		neighbors: SharedParameterNeighborIndexContract,
	): SharedParameterCandidate[] {
		const candidates: SharedParameterCandidate[] = [];
		for (const [index, node] of nodes.entries()) {
			candidates.push({ kind: this._kind, nodes: [node], locations: node.locations, support: node.locations.length });
			this._candidate_explorer.append_maximal_candidates({
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
	private unique_candidates(candidate_results: readonly SharedParameterCandidate[]): SharedParameterCandidate[] {
		const unique = new Map<string, SharedParameterCandidate>();
		for (const candidate of candidate_results) {
			const key = candidate.nodes.map((node) => node.key).join("\u0000");
			unique.set(key, candidate);
		}
		return [...unique.values()];
	}

	/** Responsibilities: _initialization analyzer normalization callable_. **/
	public constructor(callables: readonly AnalyzedCallable[]) {
		this._callables = callables;
		const first_callable = callables[0];
		this._has_kind = first_callable !== undefined;
		this._kind = "method";
		if (first_callable !== undefined) {
			this._kind = first_callable.kind;
		}
		this._candidate_explorer = new SharedParameterCandidateExplorer(this._kind);
		this._neighbor_index = new SharedParameterNeighborIndex();
		this._valid_scope = true;
		if (this._has_kind) {
			this._valid_scope = callables.every((callable) => callable.kind === this._kind);
		}
	}

	/** Responsibilities: _output immutable shared-parameter groups_. **/
	public shared_parameters(): ReadonlyMap<string, SharedParameterNode> {
		if (!this._valid_scope) {
			return new Map();
		}
		const mutable_nodes = new Map<string, MutableParameterNode>();
		for (const callable of this._callables) {
			this.append_callable(mutable_nodes, callable);
		}
		const mutable_node_values = [...mutable_nodes.values()];
		const nodes = mutable_node_values.map((node) => this.immutable_node(node));
		nodes.sort((left, right) => this._candidate_explorer.compare_nodes(left, right));
		return new Map(nodes.map((node) => [node.key, node]));
	}

	/** Responsibilities: _collection shared parameters satisfy_. **/
	public collect_candidates(): SharedParameterCandidate[] {
		const shared_parameter_values = [...this.shared_parameters().values()];
		const nodes = shared_parameter_values.filter((node) => node.locations.length >= MIN_SHARED_METHODS);
		this._neighbor_index.prepare(nodes);
		const candidates = this.unique_candidates(this.root_candidates(nodes, this._neighbor_index));
		const compacted = this.compact_candidates(candidates);
		compacted.sort((left, right) => this._candidate_explorer.compare_candidates(left, right));
		return compacted;
	}
}
