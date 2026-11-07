import type ts from "typescript";

import { TypeScriptAstTraversalIndex } from "src/parser/analysis/type_script_ast_traversal_index";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type {
	CallableTypeScriptAstTraversalVisitor,
	CallableTypeScriptFunctionOwnerVisitor,
	CallableTypeScriptPrunedNodeVisitor,
} from "src/typescript_runtime_types";

/** Responsibilities: _AST node order_, _subtree decisions_. **/
export class TypeScriptAstTraversal implements TypeScriptAstTraversalContract {
	private readonly _index: TypeScriptAstTraversalIndex;

	/** Responsibilities: _unindexed child visitation_. **/
	private visit_unindexed_children(
		fallback_subtree_root: ts.Node,
		should_descend: CallableTypeScriptPrunedNodeVisitor,
	): void {
		const pending_nodes: ts.Node[] = [];
		fallback_subtree_root.forEachChild((child) => {
			pending_nodes.push(child);
		});
		while (pending_nodes.length > 0) {
			const current = pending_nodes.pop();
			if (current === undefined) {
				continue;
			}
			if (!should_descend(current)) {
				continue;
			}
			current.forEachChild((child) => {
				pending_nodes.push(child);
			});
		}
	}

	/** Responsibilities: _AST traversal dependencies_. **/
	public constructor(source_file: ts.SourceFile) {
		this._index = new TypeScriptAstTraversalIndex(source_file);
	}

	/** Responsibilities: _AST index preparation_, _analysis readiness_. **/
	public prepare_for_analysis(): void {
		if (this._index.nodes().length === 0) {
			this._index.collect();
		}
	}

	/** Responsibilities: _cached AST node sequence_. **/
	public visit(visitor: CallableTypeScriptAstTraversalVisitor): void {
		this.prepare_for_analysis();
		for (const traversal_node of this._index.nodes()) {
			visitor(traversal_node);
		}
	}

	/** Responsibilities: _AST descendant sequence_. **/
	public visit_descendants(visitor: CallableTypeScriptAstTraversalVisitor): void {
		this.prepare_for_analysis();
		const nodes = this._index.nodes();
		for (let index = 1; index < nodes.length; index += 1) {
			const traversal_node = nodes[index];
			if (traversal_node !== undefined) {
				visitor(traversal_node);
			}
		}
	}

	/** Responsibilities: _node kind membership_, _subtree decisions_. **/
	public visit_registered_nodes(
		filtered_traversal_root: ts.Node,
		visitor: CallableTypeScriptPrunedNodeVisitor,
		registered_kinds: ArrayLike<number>,
	): void {
		this.prepare_for_analysis();
		const should_descend: CallableTypeScriptPrunedNodeVisitor = (node) => {
			const is_registered = registered_kinds[node.kind];
			if (is_registered === undefined) {
				return true;
			}
			if (is_registered === 0) {
				return true;
			}
			return visitor(node);
		};
		const found_in_cache = this._index.visit_cached_nodes(filtered_traversal_root, (traversal_node) =>
			should_descend(traversal_node.node),
		);
		if (!found_in_cache) {
			if (should_descend(filtered_traversal_root)) {
				this.visit_unindexed_children(filtered_traversal_root, should_descend);
			}
		}
	}

	/** Responsibilities: _node callback sequence_. **/
	public dispatch_registered_nodes(
		dispatch_root: ts.Node,
		node_visitor: CallableTypeScriptAstTraversalVisitor,
		registered_node_kinds: ArrayLike<number>,
	): void {
		this.prepare_for_analysis();
		this._index.visit_cached_nodes(dispatch_root, (traversal_node) => {
			if (registered_node_kinds[traversal_node.node.kind] === 1) {
				node_visitor(traversal_node);
			}
			return true;
		});
	}

	/** Responsibilities: _function owner associations_. **/
	public visit_function_owners(visitor: CallableTypeScriptFunctionOwnerVisitor): void {
		this.prepare_for_analysis();
		for (const traversal_node of this._index.nodes()) {
			visitor(traversal_node.node, traversal_node.function_owner);
		}
	}
}
