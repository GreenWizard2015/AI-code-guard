import { CompositionModel } from 'src/bridge/ts/runner/orchestration/runtime/composition/composition-parser';
import type { Violation } from 'src/protocols';
import type { LintSourceRecord } from 'src/types';
import type { ClassGraph } from 'src/types';
import { CompositionAnalyzer } from 'src/bridge/ts/runner/orchestration/runtime/composition/composition-analyzer';


/** Responsibilities: _class composition graphs construction_, _composition violations collection_. **/
export class Composition {
	public readonly MAX_COMPOSITION_DEPTH = 3;
	private readonly supported_extensions = ['.py', '.ts', '.tsx'];

	/** Responsibilities: _supported source languages identification_. **/
	private source_supported(source: LintSourceRecord): boolean {
		for (const extension of this.supported_extensions) {
			if (source.absolute_path.endsWith(extension)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _collection classes incoming dependencies_. **/
	private incoming_dependencies(graph: ClassGraph): Set<string> {
		const incoming = new Set<string>();
		for (const current of graph.classes.values()) {
			for (const dependency of current.dependencies) {
				incoming.add(dependency);
			}
		}
		return incoming;
	}

	/** Responsibilities: _construction class composition graph_. **/
	public composition_graph(sources: readonly LintSourceRecord[]): ClassGraph {
		const composition_parser = new CompositionModel();

		const supported_sources: LintSourceRecord[] = [];
		for (const source of sources) {
			if (this.source_supported(source)) {
				supported_sources.push(source);
			}
		}
		return composition_parser.class_graph(supported_sources);
	}

	/** Responsibilities: _composition violations collection_. **/
	public collect_composition(sources: readonly LintSourceRecord[], repo_root: string): Violation[] {
		const graph = this.composition_graph(sources);
		const incoming = this.incoming_dependencies(graph);
		const analyzer = new CompositionAnalyzer(graph, repo_root, incoming);
		return analyzer.violations();
	}
}
