import { SharedParameterOrder } from 'src/bridge/ts/core/shared-parameter-order';
import { MIN_ARGUMENT_USES, MIN_SHARED_METHODS } from 'src/constants';
import type {
	AnalyzedCallable,
	AnalyzedParameter,
	CallableLocation,
	SharedCallableKind,
	SharedParameterCandidate,
	SharedParameterNode,
} from 'src/metrics/types';


import type { MutableParameterNode } from 'src/metrics/types';

/** Responsibilities: _normalization callables group shared_. **/
export class SharedParameterAnalyzer {
	private readonly callables: readonly AnalyzedCallable[];
	private readonly kind: SharedCallableKind;
	private readonly has_kind: boolean;
	private readonly valid_scope: boolean;

	/** Responsibilities: _parameter shared-parameter grouping addition_. **/
	private append_parameter(
		nodes: Map<string, MutableParameterNode>,
		parameter: AnalyzedParameter,
		location: CallableLocation
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
	private append_callable(
		nodes: Map<string, MutableParameterNode>,
		callable: AnalyzedCallable
	): void {
		const parameter_keys = new Set<string>();
		for (const parameter of callable.parameters) {
if (parameter.uses < MIN_ARGUMENT_USES || parameter_keys.has(parameter.key)) {
				continue;
			}
			parameter_keys.add(parameter.key);
			this.append_parameter(nodes, parameter, callable.location);
		}
	}

	/** Responsibilities: _mutable parameter analysis conversion_. **/
	private immutable_node(node: MutableParameterNode): SharedParameterNode {
		const shared_parameter_order = new SharedParameterOrder();

		const locations = [...node.locations.values()].sort((left, right) =>
			shared_parameter_order.compare_locations(left, right)
		);
		return {
			key: node.key,
			identity: node.identity,
			kind: node.kind,
			project_type: node.project_type,
			locations,
		};
	}

	/** Responsibilities: _construction candidates parameters shared_. **/
	private branch_candidates(
		nodes: readonly SharedParameterNode[],
		next_index: number,
		selected: readonly SharedParameterNode[],
		locations: readonly CallableLocation[]
	): SharedParameterCandidate[] {
		if (!this.has_kind) {
			return [];
		}
		const candidates: SharedParameterCandidate[] = [
			{
				kind: this.kind,
				nodes: selected,
				locations,
				support: locations.length,
			},
		];
		candidates.push(...this.extended_candidates(nodes, next_index, selected, locations));
		return candidates;
	}

	/** Responsibilities: _extend candidates callable parameter_. **/
	private extended_candidates(
		nodes: readonly SharedParameterNode[],
		next_index: number,
		selected: readonly SharedParameterNode[],
		locations: readonly CallableLocation[]
	): SharedParameterCandidate[] {
		const shared_parameter_order = new SharedParameterOrder();

		const candidates: SharedParameterCandidate[] = [];
		for (let index = next_index; index < nodes.length; index += 1) {
			const intersection = shared_parameter_order.intersect_locations(locations, nodes[index].locations);
			if (intersection.length < MIN_SHARED_METHODS) {
				continue;
			}
			candidates.push(
				...this.branch_candidates(nodes, index + 1, [...selected, nodes[index]], intersection)
			);
		}
		return candidates;
	}

	/** Responsibilities: _initialization analyzer normalization callable_. **/
	public constructor(callables: readonly AnalyzedCallable[]) {
		this.callables = callables;
		const first_callable = callables[0];
		this.has_kind = first_callable !== undefined;
		this.kind = 'method';
		if (first_callable !== undefined) {
			this.kind = first_callable.kind;
		}
		this.valid_scope = true;
		if (this.has_kind) {
			this.valid_scope = callables.every(callable => callable.kind === this.kind);
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
		const nodes = [...mutable_nodes.values()].map(node => this.immutable_node(node));
		nodes.sort((left, right) => shared_parameter_order.compare_nodes(left, right));
		return new Map(nodes.map(node => [node.key, node]));
	}

	/** Responsibilities: _collection shared parameters satisfy_. **/
	public collect_candidates(): SharedParameterCandidate[] {
		const shared_parameter_order = new SharedParameterOrder();

		const nodes = [...this.shared_parameters().values()].filter(
			node => node.locations.length >= MIN_SHARED_METHODS
		);
		const candidates: SharedParameterCandidate[] = [];
		for (let index = 0; index < nodes.length; index += 1) {
			const node = nodes[index];
			if (node.kind !== 'reference') {
				continue;
			}
			candidates.push(...this.branch_candidates(nodes, index + 1, [node], node.locations));
		}
		candidates.sort((left, right) => shared_parameter_order.compare_candidates(left, right));
		return candidates;
	}
}
