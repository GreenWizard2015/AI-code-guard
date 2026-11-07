import type { CompositionTraversalState } from "src/contracts/types/composition_types";
import type { ClassGraph } from "src/model_types";

/** Responsibilities: _composition graph traversal_, _component source selection_. **/
export class CompositionGraphTraversal {
	private readonly _graph: ClassGraph;
	private readonly _reverse: ReadonlyMap<string, readonly string[]>;
	private readonly _visited: Set<string>;
	private readonly _component_visited: Set<string>;
	private readonly _order: string[];

	/** Responsibilities: _unvisited dependency state collection_. **/
	private append_unvisited_dependencies(key: string, pending: CompositionTraversalState[]): void {
		const node = this._graph.classes.get(key);
		if (node === undefined) {
			return;
		}
		for (const dependency of node.dependencies) {
			if (!this._visited.has(dependency)) {
				pending.push({ key: dependency, expanded: false });
			}
		}
	}

	/** Responsibilities: _postorder state expansion_. **/
	private append_postorder_state(state: CompositionTraversalState, pending: CompositionTraversalState[]): void {
		if (state.expanded) {
			this._order.push(state.key);
			return;
		}
		if (this._visited.has(state.key)) {
			return;
		}
		this._visited.add(state.key);
		pending.push({ key: state.key, expanded: true });
		this.append_unvisited_dependencies(state.key, pending);
	}

	/** Responsibilities: _dependency postorder construction_. **/
	private append_postorder(start: string): void {
		const pending: CompositionTraversalState[] = [{ key: start, expanded: false }];
		while (pending.length > 0) {
			const state = pending.pop();
			if (state !== undefined) {
				this.append_postorder_state(state, pending);
			}
		}
	}

	/** Responsibilities: _reverse dependency component collection_. **/
	private append_component(start: string): string[] {
		const component: string[] = [];
		const pending = [start];
		while (pending.length > 0) {
			const key = pending.pop();
			if (key === undefined || this._component_visited.has(key)) {
				continue;
			}
			this._component_visited.add(key);
			component.push(key);
			const predecessors = this._reverse.get(key);
			if (predecessors !== undefined) {
				pending.push(...predecessors);
			}
		}
		return component;
	}

	/** Responsibilities: _strongly connected component collection_. **/
	private components_from(order: readonly string[]): string[][] {
		const components: string[][] = [];
		this._component_visited.clear();
		const reversed_order = [...order];
		reversed_order.reverse();
		for (const key of reversed_order) {
			if (this._component_visited.has(key)) {
				continue;
			}
			components.push(this.append_component(key));
		}
		return components;
	}

	/** Responsibilities: _component membership indexing_. **/
	private component_index(components: readonly (readonly string[])[]): Map<string, number> {
		const index_by_key = new Map<string, number>();
		for (let index = 0; index < components.length; index += 1) {
			const component = components[index];
			if (component === undefined) {
				continue;
			}
			for (const key of component) {
				index_by_key.set(key, index);
			}
		}
		return index_by_key;
	}

	/** Responsibilities: _external component incoming edges_. **/
	private external_incoming_components(component_by_key: ReadonlyMap<string, number>): Set<number> {
		const incoming = new Set<number>();
		for (const [key, node] of this._graph.classes) {
			const source_component = component_by_key.get(key);
			if (source_component === undefined) {
				continue;
			}
			for (const dependency of node.dependencies) {
				const target_component = component_by_key.get(dependency);
				if (target_component !== undefined && target_component !== source_component) {
					incoming.add(target_component);
				}
			}
		}
		return incoming;
	}

	/** Responsibilities: _source component filtering_. **/
	private source_components_from(order: readonly string[]): string[][] {
		const components = this.components_from(order);
		const component_by_key = this.component_index(components);
		const incoming = this.external_incoming_components(component_by_key);
		return components.filter((_, index) => !incoming.has(index));
	}

	/** Responsibilities: _initialization composition graph traversal_. **/
	public constructor(graph: ClassGraph, reverse: ReadonlyMap<string, readonly string[]>) {
		this._graph = graph;
		this._reverse = reverse;
		this._visited = new Set();
		this._component_visited = new Set();
		this._order = [];
	}

	/** Responsibilities: _postorder graph traversal_. **/
	public postorder(): string[] {
		this._visited.clear();
		this._order.splice(0);
		for (const key of this._graph.classes.keys()) {
			this.append_postorder(key);
		}
		return this._order;
	}

	/** Responsibilities: _source component collection_. **/
	public source_components(): string[][] {
		return this.source_components_from(this.postorder());
	}
}
