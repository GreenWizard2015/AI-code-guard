import type { CompositionComponentsContract } from "src/contracts/protocols/composition_protocols";
import { CompositionGraphTraversal } from "src/linting/composition/components/composition_graph_traversal";
import type { ClassGraph } from "src/model_types";

/** Responsibilities: _strongly connected components_, _source component classification_. **/
export class CompositionComponents implements CompositionComponentsContract {
	private readonly _graph: ClassGraph;

	/** Responsibilities: _reverse dependency graph construction_. **/
	private reverse_graph(): Map<string, string[]> {
		const reverse = new Map<string, string[]>();
		for (const key of this._graph.classes.keys()) {
			reverse.set(key, []);
		}
		for (const [key, node] of this._graph.classes) {
			for (const dependency of node.dependencies) {
				const predecessors = reverse.get(dependency);
				if (predecessors !== undefined) {
					predecessors.push(key);
				}
			}
		}
		return reverse;
	}

	/** Responsibilities: _initialization composition component analysis_. **/
	public constructor(graph: ClassGraph) {
		this._graph = graph;
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
		const reverse = this.reverse_graph();
		const traversal = new CompositionGraphTraversal(this._graph, reverse);
		const components = traversal.source_components();
		return components;
	}
}
