import type { ClassGraph, CodeClass } from "src/types";
import type {
	CompositionChainFrame,
	CompositionChainState,
	CompositionFrameContext,
} from "src/linting/orchestration/runtime/composition/components/types";
import type { CompositionChainContract } from "src/linting/orchestration/runtime/composition/protocols";
import { MAX_COMPOSITION_DEPTH } from "src/linting/orchestration/runtime/composition/constants";

/** Responsibilities: _composition chain state_, _iterative dependency traversal_. **/
export class CompositionChain implements CompositionChainContract {
	private readonly graph: ClassGraph;
	private readonly memo: Map<string, CompositionChainState>;

	/** Responsibilities: _longest dependency selection_. **/
	private select_chain(frame: CompositionChainFrame, key: string, depth: number): void {
		if (depth >= frame.best_depth) {
			frame.best_depth = depth;
			frame.best_next = key;
		}
	}

	/** Responsibilities: _completed chain frame state_. **/
	private complete_frame(frame: CompositionChainFrame, context: CompositionFrameContext): void {
		const state = { depth: frame.best_depth + 1, next_key: frame.best_next };
		context.states.set(frame.key, state);
		if (frame.cycle_dependent) {
			context.contextual.add(frame.key);
		} else {
			this.memo.set(frame.key, state);
		}
		context.active.delete(frame.key);
		context.frames.pop();
	}

	/** Responsibilities: _cached dependency state selection_. **/
	private append_cached_dependency(
		frame: CompositionChainFrame,
		dependency: string,
		context: CompositionFrameContext,
	): boolean {
		const local_state = context.states.get(dependency);
		const waiting_for_dependency = frame.waiting_for === dependency;
		let dependency_state = this.memo.get(dependency);
		if (local_state !== undefined && (waiting_for_dependency || !context.contextual.has(dependency))) {
			dependency_state = local_state;
		}
		if (dependency_state === undefined) {
			return false;
		}
		frame.waiting_for = "";
		frame.next_index += 1;
		this.select_chain(frame, dependency, dependency_state.depth);
		return true;
	}

	/** Responsibilities: _cycle dependency state selection_. **/
	private append_cycle_dependency(
		frame: CompositionChainFrame,
		dependency: string,
		context: CompositionFrameContext,
	): void {
		frame.waiting_for = "";
		for (const current of context.frames) {
			current.cycle_dependent = true;
		}
		frame.next_index += 1;
		this.select_chain(frame, dependency, 1);
	}

	/** Responsibilities: _bounded cyclic witness traversal_. **/
	private append_bounded_dependency(frame: CompositionChainFrame, context: CompositionFrameContext): boolean {
		if (!frame.cycle_dependent) {
			return false;
		}
		if (context.frames.length < MAX_COMPOSITION_DEPTH + 2) {
			return false;
		}
		frame.next_index += 1;
		return true;
	}

	/** Responsibilities: _dependency frame advancement_. **/
	private append_dependency_frame(
		frame: CompositionChainFrame,
		dependency: string,
		context: CompositionFrameContext,
	): void {
		if (this.append_cached_dependency(frame, dependency, context)) {
			return;
		}
		if (context.active.has(dependency)) {
			this.append_cycle_dependency(frame, dependency, context);
			return;
		}
		if (this.append_bounded_dependency(frame, context)) {
			return;
		}
		frame.waiting_for = dependency;
		context.frames.push({
			key: dependency,
			next_index: 0,
			best_depth: 0,
			best_next: "",
			cycle_dependent: false,
			waiting_for: "",
		});
	}

	/** Responsibilities: _dependency frame advancement_. **/
	private advance_frame(frame: CompositionChainFrame, node: CodeClass, context: CompositionFrameContext): boolean {
		if (frame.next_index >= node.dependencies.length) {
			return false;
		}
		const dependency = node.dependencies[frame.next_index];
		if (dependency === undefined) {
			frame.next_index += 1;
			return true;
		}
		this.append_dependency_frame(frame, dependency, context);
		return true;
	}

	/** Responsibilities: _iterative dependency frame processing_. **/
	private process_frame(context: CompositionFrameContext): void {
		const frame = context.frames[context.frames.length - 1];
		if (!context.active.has(frame.key)) {
			context.active.add(frame.key);
		}
		const node = this.graph.classes.get(frame.key);
		if (node === undefined) {
			this.complete_missing_frame(frame, context);
			return;
		}
		if (this.advance_frame(frame, node, context)) {
			return;
		}
		this.complete_frame(frame, context);
	}

	/** Responsibilities: _missing dependency frame completion_. **/
	private complete_missing_frame(frame: CompositionChainFrame, context: CompositionFrameContext): void {
		const state = { depth: 0, next_key: "" };
		context.states.set(frame.key, state);
		this.memo.set(frame.key, state);
		context.active.delete(frame.key);
		context.frames.pop();
	}

	/** Responsibilities: _iterative chain state collection_. **/
	private traversal_states(key: string): Map<string, CompositionChainState> {
		const states = new Map<string, CompositionChainState>();
		const cached = this.memo.get(key);
		if (cached !== undefined) {
			states.set(key, cached);
			return states;
		}
		const context: CompositionFrameContext = {
			active: new Set<string>(),
			frames: [
				{ key, next_index: 0, best_depth: 0, best_next: "", cycle_dependent: false, waiting_for: "" },
			],
			states,
			contextual: new Set<string>(),
		};
		while (context.frames.length > 0) {
			this.process_frame(context);
		}
		return states;
	}

	/** Responsibilities: _chain node state_. **/
	private next_chain_key(
		current: string,
		names: string[],
		visited: Set<string>,
		states: ReadonlyMap<string, CompositionChainState>,
	): string {
		const node = this.graph.classes.get(current);
		if (node === undefined) {
			return "";
		}
		names.push(node.name);
		if (visited.has(current)) {
			return "";
		}
		visited.add(current);
		return this.chain_next_key(current, states);
	}

	/** Responsibilities: _chain successor state lookup_. **/
	private chain_next_key(current: string, states: ReadonlyMap<string, CompositionChainState>): string {
		let state = states.get(current);
		if (state === undefined) {
			state = this.memo.get(current);
		}
		if (state === undefined) {
			return "";
		}
		return state.next_key;
	}

	/** Responsibilities: _longest chain reconstruction_. **/
	private chain_names(key: string, states: ReadonlyMap<string, CompositionChainState>): string[] {
		const names: string[] = [];
		const visited = new Set<string>();
		let current = key;
		while (current.length > 0) {
			current = this.next_chain_key(current, names, visited, states);
		}
		return names;
	}

	/** Responsibilities: _composition chain initialization_. **/
	public constructor(graph: ClassGraph) {
		this.memo = new Map<string, CompositionChainState>();
		this.graph = graph;
	}

	/** Responsibilities: _longest composition chain_. **/
	public chain(key: string): string[] {
		const states = this.traversal_states(key);
		return this.chain_names(key, states);
	}

	/** Responsibilities: _composition chain depth_. **/
	public depth(key: string): number {
		const states = this.traversal_states(key);
		const state = states.get(key);
		if (state === undefined) {
			return 0;
		}
		return state.depth;
	}
}
