import { TypeScriptDirectClassState } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_direct_class_state";
import type {
	InheritedStateDeclaration,
	InheritedStateNodes,
	InheritedStateTraversal,
} from "src/rules/typescript/syntax-rules/types";
import ts from "typescript";

/** Responsibilities: _inherited state declaration graph_, _stateful class ancestry_. **/
export class InheritedStateProjectGraph {
	private readonly _declarations: readonly InheritedStateDeclaration[];
	private readonly _collection_mutators: ReadonlySet<string>;

	/** Responsibilities: _inherited state dependency indexing_. **/
	private dependents(): Map<string, string[]> {
		const dependents = new Map<string, string[]>();
		for (const declaration of this._declarations) {
			for (const base_symbol_id of declaration.base_symbol_ids) {
				let children = dependents.get(base_symbol_id);
				if (children === undefined) {
					children = [];
					dependents.set(base_symbol_id, children);
				}
				children.push(declaration.symbol_id);
			}
		}
		return dependents;
	}

	/** Responsibilities: _stateful descendant indexing_. **/
	private append_dependents(base_symbol_id: string, traversal: InheritedStateTraversal): void {
		for (const child_symbol_id of traversal.dependents.get(base_symbol_id) ?? []) {
			if (traversal.stateful_names.has(child_symbol_id)) {
				continue;
			}
			traversal.stateful_names.add(child_symbol_id);
			traversal.inherited_names.add(child_symbol_id);
			traversal.pending.push(child_symbol_id);
		}
	}

	/** Responsibilities: _project state graph setup_. **/
	public constructor(declarations: readonly InheritedStateDeclaration[], collection_mutators: ReadonlySet<string>) {
		this._declarations = declarations;
		this._collection_mutators = collection_mutators;
	}

	/** Responsibilities: _direct stateful project names_. **/
	public direct_stateful_names(): Set<string> {
		const names = new Set<string>();
		for (const declaration of this._declarations) {
			if (!ts.isClassLike(declaration.syntax_node)) {
				continue;
			}
			const analysis = new TypeScriptDirectClassState(
				declaration.node,
				declaration.syntax_node,
				this._collection_mutators,
			);
			if (analysis.stateful_instance()) {
				names.add(declaration.symbol_id);
			}
		}
		return names;
	}

	/** Responsibilities: _stateful descendant collection_. **/
	public inherited_state_nodes(stateful_names: Set<string>): InheritedStateNodes {
		const traversal: InheritedStateTraversal = {
			dependents: this.dependents(),
			inherited_names: new Set<string>(),
			pending: [...stateful_names],
			stateful_names,
		};
		while (traversal.pending.length > 0) {
			const base_symbol_id = traversal.pending.pop();
			if (base_symbol_id === undefined) {
				continue;
			}
			this.append_dependents(base_symbol_id, traversal);
		}
		return traversal.inherited_names;
	}
}
