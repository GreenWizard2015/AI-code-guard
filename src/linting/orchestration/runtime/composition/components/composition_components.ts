import type { ClassGraph } from "src/types";
import type { CompositionComponentsContract } from "src/linting/orchestration/runtime/composition/protocols";
import type { CompositionTraversalState } from "src/linting/orchestration/runtime/composition/types";

/** Responsibilities: _strongly connected components_, _source component classification_. **/
export class CompositionComponents implements CompositionComponentsContract {
	private readonly graph: ClassGraph;

	/** Responsibilities: _unvisited dependency state collection_. **/
	private append_unvisited_dependencies(
		key: string,
		visited: ReadonlySet<string>,
		pending: CompositionTraversalState[],
	): void {
		const node = this.graph.classes.get(key);
		if (node === undefined) {
			return;
		}
		for (const dependency of node.dependencies) {
			if (!visited.has(dependency)) {
				pending.push({ key: dependency, expanded: false });
			}
		}
	}

	/** Responsibilities: _postorder state expansion_. **/
	private append_postorder_state(
		state: CompositionTraversalState,
		visited: Set<string>,
		order: string[],
		pending: CompositionTraversalState[],
	): void {
		if (state.expanded) {
			order.push(state.key);
			return;
		}
		if (visited.has(state.key)) {
			return;
		}
		visited.add(state.key);
		pending.push({ key: state.key, expanded: true });
		this.append_unvisited_dependencies(state.key, visited, pending);
	}

	/** Responsibilities: _dependency postorder construction_. **/
	private append_postorder(start: string, visited: Set<string>, order: string[]): void {
		const pending: CompositionTraversalState[] = [{ key: start, expanded: false }];
		while (pending.length > 0) {
			const state = pending.pop();
			if (state === undefined) {
				continue;
			}
			this.append_postorder_state(state, visited, order, pending);
		}
	}

	/** Responsibilities: _reverse dependency component collection_. **/
	private append_component(
		start: string,
		reverse: ReadonlyMap<string, readonly string[]>,
		visited: Set<string>,
		component: string[],
	): void {
		const pending = [start];
		while (pending.length > 0) {
			const key = pending.pop();
			if (key === undefined) {
				continue;
			}
			if (visited.has(key)) {
				continue;
			}
			visited.add(key);
			component.push(key);
			const predecessors = reverse.get(key);
			if (predecessors !== undefined) {
				pending.push(...predecessors);
			}
		}
	}

	/** Responsibilities: _reverse dependency graph construction_. **/
	private reverse_graph(): Map<string, string[]> {
		const reverse = new Map<string, string[]>();
		for (const key of this.graph.classes.keys()) {
			reverse.set(key, []);
		}
		for (const [key, node] of this.graph.classes) {
			for (const dependency of node.dependencies) {
				const predecessors = reverse.get(dependency);
				if (predecessors !== undefined) {
					predecessors.push(key);
				}
			}
		}
		return reverse;
	}

	/** Responsibilities: _postorder graph traversal_. **/
	private postorder(): string[] {
		const order: string[] = [];
		const visited = new Set<string>();
		for (const key of this.graph.classes.keys()) {
			this.append_postorder(key, visited, order);
		}
		return order;
	}

	/** Responsibilities: _strongly connected component collection_. **/
	private components_from(order: readonly string[], reverse: ReadonlyMap<string, readonly string[]>): string[][] {
		const components: string[][] = [];
		const visited = new Set<string>();
		const reversed_order = [...order];
		reversed_order.reverse();
		for (const key of reversed_order) {
			if (visited.has(key)) {
				continue;
			}
			const component: string[] = [];
			this.append_component(key, reverse, visited, component);
			components.push(component);
		}
		return components;
	}

	/** Responsibilities: _component membership indexing_. **/
	private component_index(components: readonly (readonly string[])[]): Map<string, number> {
		const index_by_key = new Map<string, number>();
		for (let index = 0; index < components.length; index += 1) {
			for (const key of components[index]) {
				index_by_key.set(key, index);
			}
		}
		return index_by_key;
	}

	/** Responsibilities: _external component incoming edges_. **/
	private external_incoming_components(component_by_key: ReadonlyMap<string, number>): Set<number> {
		const incoming = new Set<number>();
		for (const [key, node] of this.graph.classes) {
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
	private source_components_from(
		order: readonly string[],
		reverse: ReadonlyMap<string, readonly string[]>,
	): string[][] {
		const components = this.components_from(order, reverse);
		const component_by_key = this.component_index(components);
		const incoming = this.external_incoming_components(component_by_key);
		const component_entries = [...components.entries()];
		const source_entries = component_entries.filter(([index]) => !incoming.has(index));
		return source_entries.map(([, component]) => component);
	}

	/** Responsibilities: _initialization composition component analysis_. **/
	public constructor(graph: ClassGraph) {
		this.graph = graph;
	}

	/** Responsibilities: _component representative selection_. **/
	public representative(component: readonly string[]): string {
		const ordered_component = [...component];
		ordered_component.sort();
		for (const key of ordered_component) {
			return key;
		}
		throw new Error("Composition source component is empty.");
	}

	/** Responsibilities: _source component collection_. **/
	public source_components(): string[][] {
		return this.source_components_from(this.postorder(), this.reverse_graph());
	}
}
