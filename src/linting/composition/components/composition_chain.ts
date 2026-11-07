import type { CompositionChainContract } from "src/contracts/protocols/composition_protocols";
import { CompositionChainAnalysis } from "src/linting/composition/components/composition_chain_analysis";
import type { ClassGraph } from "src/model_types";

/** Responsibilities: _composition graph access_, _chain analysis reuse_. **/
export class CompositionChain implements CompositionChainContract {
	private readonly _graph: ClassGraph;
	private readonly _memo_depths: Map<string, number>;
	private readonly _memo_next_keys: Map<string, string>;
	private readonly _analyses: Map<string, CompositionChainAnalysis>;

	/** Responsibilities: _composition chain initialization_. **/
	public constructor(graph: ClassGraph) {
		this._graph = graph;
		this._memo_depths = new Map<string, number>();
		this._memo_next_keys = new Map<string, string>();
		this._analyses = new Map<string, CompositionChainAnalysis>();
	}

	/** Responsibilities: _longest composition chain_. **/
	public chain(key: string): string[] {
		let analysis = this._analyses.get(key);
		if (analysis === undefined) {
			analysis = new CompositionChainAnalysis(this._graph, this._memo_depths, this._memo_next_keys, key);
			this._analyses.set(key, analysis);
		}
		return analysis.chain();
	}

	/** Responsibilities: _composition chain depth_. **/
	public depth(key: string): number {
		let analysis = this._analyses.get(key);
		if (analysis === undefined) {
			analysis = new CompositionChainAnalysis(this._graph, this._memo_depths, this._memo_next_keys, key);
			this._analyses.set(key, analysis);
		}
		return analysis.depth();
	}
}
