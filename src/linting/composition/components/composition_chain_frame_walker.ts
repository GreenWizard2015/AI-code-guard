import { MAX_COMPOSITION_DEPTH } from "src/constants";
import type { CompositionChainFrameContract } from "src/contracts/protocols/composition_protocols";
import type { CompositionFrameContext } from "src/contracts/types/composition_types";
import { CompositionChainFrame } from "src/linting/composition/components/composition_chain_frame";
import type { ClassGraph } from "src/model_types";

/** Responsibilities: _composition dependency frame transitions_, _bounded cycle traversal_. **/
export class CompositionChainFrameWalker {
	private readonly _graph: ClassGraph;
	private readonly _memo_depths: Map<string, number>;
	private readonly _memo_next_keys: Map<string, string>;
	private readonly _context: CompositionFrameContext;

	/** Responsibilities: _active traversal frame_. **/
	private active_frame(): CompositionChainFrameContract {
		const frame = this._context.frames.at(-1);
		if (frame === undefined) {
			throw new Error("Composition traversal has no active frame.");
		}
		return frame;
	}

	/** Responsibilities: _cached dependency state selection_. **/
	private append_cached_dependency(): boolean {
		const frame = this.active_frame();
		const dependency = frame.dependency();
		const local_depth = this._context.depths.get(dependency);
		const waiting_for_dependency = frame.waiting_for(dependency);
		let dependency_depth = this._memo_depths.get(dependency);
		if (local_depth !== undefined && (waiting_for_dependency || !this._context.contextual.has(dependency))) {
			dependency_depth = local_depth;
		}
		if (dependency_depth === undefined) {
			return false;
		}
		frame.clear_waiting();
		frame.advance_dependency();
		frame.consider_chain(dependency, dependency_depth);
		return true;
	}

	/** Responsibilities: _cycle dependency state selection_. **/
	private append_cycle_dependency(): void {
		const frame = this.active_frame();
		frame.clear_waiting();
		for (const current of this._context.frames) {
			current.mark_cycle_dependent();
		}
		frame.advance_dependency();
		frame.consider_chain(frame.dependency(), 1);
	}

	/** Responsibilities: _bounded cyclic witness traversal_. **/
	private append_bounded_dependency(): boolean {
		const frame = this.active_frame();
		if (!frame.cycle_bound_exceeded(this._context.frames.length, MAX_COMPOSITION_DEPTH + 2)) {
			return false;
		}
		frame.advance_dependency();
		return true;
	}

	/** Responsibilities: _dependency frame advancement_. **/
	private append_dependency_frame(): void {
		const dependency = this.active_frame().dependency();
		if (this.append_cached_dependency()) {
			return;
		}
		if (this._context.active.has(dependency)) {
			this.append_cycle_dependency();
			return;
		}
		if (this.append_bounded_dependency()) {
			return;
		}
		this.push_dependency_frame(dependency);
	}

	/** Responsibilities: _dependency frame creation_. **/
	private push_dependency_frame(dependency: string): void {
		const frame = this.active_frame();
		frame.wait_for(dependency);
		this._context.frames.push(new CompositionChainFrame(dependency, this._graph));
	}

	/** Responsibilities: _frame traversal initialization_. **/
	public constructor(
		graph: ClassGraph,
		memo_depths: Map<string, number>,
		memo_next_keys: Map<string, string>,
		context: CompositionFrameContext,
	) {
		this._graph = graph;
		this._memo_depths = memo_depths;
		this._memo_next_keys = memo_next_keys;
		this._context = context;
	}

	/** Responsibilities: _root dependency frame creation_. **/
	public start_at(root_key: string): void {
		this._context.frames.push(new CompositionChainFrame(root_key, this._graph));
	}

	/** Responsibilities: _pending frame state_. **/
	public pending_frames(): boolean {
		return this._context.frames.length > 0;
	}

	/** Responsibilities: _dependency traversal advancement_. **/
	public advance_traversal(): void {
		const frame = this.active_frame();
		frame.mark_active(this._context.active);
		if (frame.missing_class()) {
			frame.complete_missing(this._context, this._memo_depths, this._memo_next_keys);
			return;
		}
		if (frame.pending_dependency()) {
			if (frame.dependency().length === 0) {
				frame.advance_dependency();
				return;
			}
			this.append_dependency_frame();
			return;
		}
		frame.complete(this._context, this._memo_depths, this._memo_next_keys);
	}
}
