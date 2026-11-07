import type { CompositionChainFrameContract } from "src/contracts/protocols/composition_protocols";
import type { CompositionFrameContext, CompositionFrameStateData } from "src/contracts/types/composition_types";
import type { ClassGraph } from "src/model_types";

/** Responsibilities: _composition traversal frame state_, _best dependency chain selection_. **/
export class CompositionChainFrame implements CompositionChainFrameContract {
	private readonly _key: string;
	private readonly _graph: ClassGraph;
	private readonly _state: CompositionFrameStateData;

	/** Responsibilities: _composition traversal frame initialization_. **/
	public constructor(key: string, graph: ClassGraph) {
		this._key = key;
		this._graph = graph;
		this._state = {
			next_index: 0,
			best_depth: 0,
			best_next: "",
			cycle_dependent: false,
			waiting_for: "",
		};
	}

	/** Responsibilities: _composition class lookup_. **/
	public missing_class(): boolean {
		return !this._graph.classes.has(this._key);
	}

	/** Responsibilities: _current dependency lookup_. **/
	public dependency(): string {
		const node = this._graph.classes.get(this._key);
		if (node === undefined) {
			return "";
		}
		const dependency = node.dependencies[this._state.next_index];
		if (dependency === undefined) {
			return "";
		}
		return dependency;
	}

	/** Responsibilities: _dependency frame completion_. **/
	public pending_dependency(): boolean {
		const node = this._graph.classes.get(this._key);
		if (node === undefined) {
			return false;
		}
		if (this._state.next_index < node.dependencies.length) {
			return true;
		}
		return false;
	}

	/** Responsibilities: _cycle depth bounding_. **/
	public cycle_bound_exceeded(frame_count: number, maximum: number): boolean {
		if (!this._state.cycle_dependent) {
			return false;
		}
		return frame_count >= maximum;
	}

	/** Responsibilities: _dependency pause marker_. **/
	public waiting_for(dependency: string): boolean {
		return this._state.waiting_for === dependency;
	}

	/** Responsibilities: _dependency traversal completion_. **/
	public complete_for(dependency_count: number): boolean {
		return this._state.next_index >= dependency_count;
	}

	/** Responsibilities: _active dependency marking_. **/
	public mark_active(active: Set<string>): void {
		active.add(this._key);
	}

	/** Responsibilities: _dependency cursor advancement_. **/
	public advance_dependency(): void {
		this._state.next_index += 1;
	}

	/** Responsibilities: _longest dependency selection_. **/
	public consider_chain(successor: string, depth: number): void {
		if (depth >= this._state.best_depth) {
			this._state.best_depth = depth;
			this._state.best_next = successor;
		}
	}

	/** Responsibilities: _dependency pause marker_. **/
	public clear_waiting(): void {
		this._state.waiting_for = "";
	}

	/** Responsibilities: _dependency pause position_. **/
	public wait_for(dependency: string): void {
		this._state.waiting_for = dependency;
	}

	/** Responsibilities: _cycle dependency marking_. **/
	public mark_cycle_dependent(): void {
		this._state.cycle_dependent = true;
	}

	/** Responsibilities: _completed dependency state publication_. **/
	public complete(
		context: CompositionFrameContext,
		memo_depths: Map<string, number>,
		memo_next_keys: Map<string, string>,
	): void {
		const depth = this._state.best_depth + 1;
		context.depths.set(this._key, depth);
		context.next_keys.set(this._key, this._state.best_next);
		if (this._state.cycle_dependent) {
			context.contextual.add(this._key);
		} else {
			memo_depths.set(this._key, depth);
			memo_next_keys.set(this._key, this._state.best_next);
		}
		context.active.delete(this._key);
		context.frames.pop();
	}

	/** Responsibilities: _missing dependency state publication_. **/
	public complete_missing(
		context: CompositionFrameContext,
		memo_depths: Map<string, number>,
		memo_next_keys: Map<string, string>,
	): void {
		context.depths.set(this._key, 0);
		context.next_keys.set(this._key, "");
		memo_depths.set(this._key, 0);
		memo_next_keys.set(this._key, "");
		context.active.delete(this._key);
		context.frames.pop();
	}
}
