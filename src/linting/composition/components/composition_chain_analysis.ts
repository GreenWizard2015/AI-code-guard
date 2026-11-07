import type { CompositionFrameContext } from "src/contracts/types/composition_types";
import { CompositionChainFrameWalker } from "src/linting/composition/components/composition_chain_frame_walker";
import { CompositionChainPath } from "src/linting/composition/components/composition_chain_path";
import type { ClassGraph } from "src/model_types";

/** Responsibilities: _composition chain traversal_, _chain state reconstruction_. **/
export class CompositionChainAnalysis {
	private readonly _graph: ClassGraph;
	private readonly _memo_depths: Map<string, number>;
	private readonly _memo_next_keys: Map<string, string>;
	private readonly _root_key: string;
	private readonly _context: CompositionFrameContext;
	private readonly _frame_walker: CompositionChainFrameWalker;
	private readonly _depths: Map<string, number>;
	private readonly _next_keys: Map<string, string>;

	/** Responsibilities: _iterative chain state collection_. **/
	private traversal_states(): void {
		if (this._depths.has(this._root_key)) {
			return;
		}
		const cached_depth = this._memo_depths.get(this._root_key);
		const cached_next_key = this._memo_next_keys.get(this._root_key);
		if (cached_depth !== undefined && cached_next_key !== undefined) {
			this._depths.set(this._root_key, cached_depth);
			this._next_keys.set(this._root_key, cached_next_key);
			return;
		}
		this._frame_walker.start_at(this._root_key);
		while (this._frame_walker.pending_frames()) {
			this._frame_walker.advance_traversal();
		}
	}

	/** Responsibilities: _composition analysis state_. **/
	public constructor(
		graph: ClassGraph,
		memo_depths: Map<string, number>,
		memo_next_keys: Map<string, string>,
		root_key: string,
	) {
		this._graph = graph;
		this._memo_depths = memo_depths;
		this._memo_next_keys = memo_next_keys;
		this._root_key = root_key;
		this._depths = new Map<string, number>();
		this._next_keys = new Map<string, string>();
		this._context = {
			active: new Set<string>(),
			frames: [],
			depths: this._depths,
			next_keys: this._next_keys,
			contextual: new Set<string>(),
		};
		this._frame_walker = new CompositionChainFrameWalker(graph, memo_depths, memo_next_keys, this._context);
	}

	/** Responsibilities: _longest composition chain_. **/
	public chain(): string[] {
		this.traversal_states();
		const path_options = {
			classes: this._graph.classes,
			local_next_keys: this._next_keys,
			memo_next_keys: this._memo_next_keys,
			root_key: this._root_key,
		};
		const path = new CompositionChainPath(path_options);
		return path.names();
	}

	/** Responsibilities: _composition chain depth_. **/
	public depth(): number {
		this.traversal_states();
		const depth = this._depths.get(this._root_key);
		if (depth === undefined) {
			return 0;
		}
		return depth;
	}
}
