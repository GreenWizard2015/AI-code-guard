import type {
	CallableTypeScriptAstTraversalDecision,
	TypeScriptAstTraversalFrame,
	TypeScriptAstTraversalNode,
} from "src/typescript_runtime_types";
import ts from "typescript";

/** Responsibilities: _AST preorder cache_, _subtree range index_. **/
export class TypeScriptAstTraversalIndex {
	private readonly _source_file: ts.SourceFile;
	private readonly _node_list: TypeScriptAstTraversalNode[];
	private readonly _subtree_end_indices: number[];
	private readonly _node_indices: WeakMap<ts.Node, number>;
	private readonly _children: ts.Node[];

	/** Responsibilities: _next cached node index_. **/
	private next_cached_index(index: number, visit_descendants: boolean): number {
		if (visit_descendants) {
			return index + 1;
		}
		return (this._subtree_end_indices[index] ?? index) + 1;
	}

	/** Responsibilities: _cached preorder range visitation_. **/
	private visit_cached_range(
		root_index: number,
		range_end: number,
		should_descend: CallableTypeScriptAstTraversalDecision,
	): void {
		let index = root_index;
		while (index <= range_end) {
			const traversal_node = this._node_list[index];
			if (traversal_node === undefined) {
				index += 1;
				continue;
			}
			index = this.next_cached_index(index, should_descend(traversal_node));
		}
	}

	/** Responsibilities: _inherited node context_. **/
	private child_context(node: ts.Node, inherited: TypeScriptAstTraversalNode): TypeScriptAstTraversalNode {
		if (ts.isClassLike(node)) {
			let owner = "";
			if (node.name !== undefined) {
				owner = node.name.text;
			}
			return { ...inherited, owner };
		}
		if (ts.isFunctionLike(node)) {
			let inside_constructor = inherited.inside_constructor;
			if (ts.isConstructorDeclaration(node)) {
				inside_constructor = true;
			}
			return { ...inherited, inside_constructor, function_owner: node };
		}
		return inherited;
	}

	/** Responsibilities: _preorder child frames_. **/
	private append_child_frames(current: TypeScriptAstTraversalFrame, pending: TypeScriptAstTraversalFrame[]): void {
		const inherited = this.child_context(current.traversal_node.node, current.traversal_node);
		this._children.length = 0;
		current.traversal_node.node.forEachChild((child) => {
			this._children.push(child);
		});
		for (let index = this._children.length - 1; index >= 0; index -= 1) {
			const child = this._children[index];
			if (child !== undefined) {
				pending.push({
					traversal_node: {
						node: child,
						inside_constructor: inherited.inside_constructor,
						owner: inherited.owner,
						function_owner: inherited.function_owner,
					},
					depth: current.depth + 1,
				});
			}
		}
	}

	/** Responsibilities: _subtree range closure_. **/
	private close_ranges(open_ranges: number[], ancestor_depth: number, final_index: number): void {
		while (open_ranges.length > ancestor_depth) {
			const closed_index = open_ranges.pop();
			if (closed_index !== undefined) {
				this._subtree_end_indices[closed_index] = final_index;
			}
		}
	}

	/** Responsibilities: _preorder node frame_. **/
	private append_collected_frame(current: TypeScriptAstTraversalFrame, open_ranges: number[]): void {
		const index = this._node_list.length;
		this.close_ranges(open_ranges, current.depth, index - 1);
		this._node_list.push(current.traversal_node);
		this._node_indices.set(current.traversal_node.node, index);
		this._subtree_end_indices.push(index);
		open_ranges.push(index);
	}

	/** Responsibilities: _source-file root frame_. **/
	private source_file_frame(): TypeScriptAstTraversalFrame {
		return {
			traversal_node: {
				node: this._source_file,
				inside_constructor: false,
				owner: "",
				function_owner: this._source_file,
			},
			depth: 0,
		};
	}

	/** Responsibilities: _traversal index dependencies_. **/
	public constructor(source_file: ts.SourceFile) {
		this._source_file = source_file;
		this._node_list = [];
		this._subtree_end_indices = [];
		this._node_indices = new WeakMap();
		this._children = [];
	}

	/** Responsibilities: _cached AST preorder_. **/
	public collect(): void {
		if (this._node_list.length > 0) {
			return;
		}
		const pending: TypeScriptAstTraversalFrame[] = [this.source_file_frame()];
		const open_ranges: number[] = [];
		while (pending.length > 0) {
			const current = pending.pop();
			if (current === undefined) {
				continue;
			}
			this.append_collected_frame(current, open_ranges);
			this.append_child_frames(current, pending);
		}
		this.close_ranges(open_ranges, 0, this._node_list.length - 1);
	}

	/** Responsibilities: _cached traversal node sequence_. **/
	public nodes(): readonly TypeScriptAstTraversalNode[] {
		return this._node_list;
	}

	/** Responsibilities: _cached subtree traversal_. **/
	public visit_cached_nodes(root_node: ts.Node, should_descend: CallableTypeScriptAstTraversalDecision): boolean {
		const root_index = this._node_indices.get(root_node);
		if (root_index === undefined) {
			return false;
		}
		const range_end = this._subtree_end_indices[root_index] ?? root_index;
		this.visit_cached_range(root_index, range_end, should_descend);
		return true;
	}
}
