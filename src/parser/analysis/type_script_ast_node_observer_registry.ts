import type {
	TypeScriptAstDispatchObserverTable,
	TypeScriptAstDispatchPhaseState,
	TypeScriptAstDispatchPhaseStateMap,
} from "src/parser/analysis/protocols";
import type { TypeScriptAstDispatchPhase } from "src/parser/analysis/protocols";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type {
	CallableTypeScriptAstNodeObserver,
	CallableTypeScriptAstTraversalVisitor,
} from "src/typescript_runtime_types";
import ts from "typescript";

/** Responsibilities: _phase observer groups_, _phase callback context_. **/
export class TypeScriptAstNodeObserverRegistry<TContext> {
	private readonly _phase_states: TypeScriptAstDispatchPhaseStateMap<TContext>;

	/** Responsibilities: _node-kind observer association_, _observer uniqueness_. **/
	private append_observer(
		observers_by_kind: TypeScriptAstDispatchObserverTable<TContext>,
		node_kind: ts.SyntaxKind,
		observer: CallableTypeScriptAstNodeObserver<TContext>,
	): void {
		let observers = observers_by_kind[node_kind];
		if (observers === undefined) {
			observers = [];
			observers_by_kind[node_kind] = observers;
		}
		if (!observers.includes(observer)) {
			observers.push(observer);
		}
	}

	/** Responsibilities: _phase dispatch state creation_. **/
	private create_phase_state(): TypeScriptAstDispatchPhaseState<TContext> {
		return {
			observers_by_kind: [],
			registered_kinds: new Uint8Array(ts.SyntaxKind.Count),
		};
	}

	/** Responsibilities: _dispatch phase states_. **/
	public constructor() {
		this._phase_states = {
			source_metadata: this.create_phase_state(),
			reference_state: this.create_phase_state(),
			file_rules: this.create_phase_state(),
			project_index: this.create_phase_state(),
		};
	}

	/** Responsibilities: _phase node associations_. **/
	public register(
		phase: TypeScriptAstDispatchPhase,
		node_kinds: readonly ts.SyntaxKind[],
		observer: CallableTypeScriptAstNodeObserver<TContext>,
	): void {
		const state = this._phase_states[phase];
		for (const node_kind of node_kinds) {
			state.registered_kinds[node_kind] = 1;
			this.append_observer(state.observers_by_kind, node_kind, observer);
		}
	}

	/** Responsibilities: _phase node callbacks_. **/
	public dispatch(
		phase: TypeScriptAstDispatchPhase,
		traversal: TypeScriptAstTraversalContract,
		root: ts.Node,
		context: TContext,
	): void {
		const state = this._phase_states[phase];
		const observer: CallableTypeScriptAstTraversalVisitor = (traversal_node) => {
			const observers = state.observers_by_kind[traversal_node.node.kind];
			if (observers === undefined) {
				return;
			}
			for (const registered_observer of observers) {
				registered_observer(traversal_node, context);
			}
		};
		traversal.dispatch_registered_nodes(root, observer, state.registered_kinds);
	}
}
