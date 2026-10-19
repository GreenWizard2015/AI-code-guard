import ts from "typescript";

import type {
	TypeScriptAstTraversalContract,
	TypeScriptAstTraversalNode,
	TypeScriptAstTraversalVisitor,
	TypeScriptFunctionOwnerVisitor,
} from "src/protocols";

/** Responsibilities: _TypeScript AST traversal order_, _constructor context_. **/
export class TypeScriptAstTraversal implements TypeScriptAstTraversalContract {
	private readonly source_file: ts.SourceFile;
	private readonly node_list: TypeScriptAstTraversalNode[];

	/** Responsibilities: _recursive TypeScript AST traversal_. **/
	private append(
		node: ts.Node,
		inside_constructor: boolean,
		owner: string,
		function_owner: ts.Node,
	): void {
		let current_function_owner = function_owner;
		if (ts.isFunctionLike(node)) {
			current_function_owner = node;
		}
		this.node_list.push({ node, inside_constructor, owner, function_owner: current_function_owner });
		let child_inside_constructor = inside_constructor;
		if (ts.isConstructorDeclaration(node)) {
			child_inside_constructor = true;
		}
		let child_owner = owner;
		if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
			if (node.name !== undefined) {
				child_owner = node.name.text;
			}
		}
		node.forEachChild((child) => this.append(child, child_inside_constructor, child_owner, current_function_owner));
	}

	/** Responsibilities: _TypeScript AST traversal initialization_. **/
	public constructor(source_file: ts.SourceFile) {
		this.source_file = source_file;
		this.node_list = [];
	}

	/** Responsibilities: _TypeScript AST traversal collection_. **/
	public collect(): void {
		if (this.node_list.length > 0) {
			return;
		}
		this.append(this.source_file, false, "", this.source_file);
	}

	/** Responsibilities: _AST traversal application_. **/
	public visit(visitor: TypeScriptAstTraversalVisitor): void {
		for (const traversal_node of this.node_list) {
			visitor(traversal_node.node, traversal_node.inside_constructor, traversal_node.owner);
		}
	}

	/** Responsibilities: _AST traversal child-node iteration_. **/
	public visit_children(visitor: TypeScriptAstTraversalVisitor): void {
		for (let index = 1; index < this.node_list.length; index += 1) {
			const traversal_node = this.node_list[index];
			if (traversal_node === undefined) {
				continue;
			}
			visitor(traversal_node.node, traversal_node.inside_constructor, traversal_node.owner);
		}
	}

	/** Responsibilities: _function-owner AST traversal reuse_. **/
	public visit_function_owners(visitor: TypeScriptFunctionOwnerVisitor): void {
		for (const traversal_node of this.node_list) {
			visitor(traversal_node.node, traversal_node.function_owner);
		}
	}

}
