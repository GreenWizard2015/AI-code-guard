import type ts from "typescript";

/** Responsibilities: _AST traversal node data_. **/
export type TypeScriptAstTraversalNode = {
	node: ts.Node;
	inside_constructor: boolean;
	owner: string;
	function_owner: ts.Node;
};

export type TypeScriptAstTraversalFrame = {
	traversal_node: TypeScriptAstTraversalNode;
	depth: number;
};

export type CallableTypeScriptAstTraversalVisitor = (traversal_node: TypeScriptAstTraversalNode) => void;

export type CallableTypeScriptAstTraversalDecision = (traversal_node: TypeScriptAstTraversalNode) => boolean;

export type CallableTypeScriptAstNodeObserver<TContext> = (
	traversal_node: TypeScriptAstTraversalNode,
	context: TContext,
) => void;

export type CallableTypeScriptPrunedNodeVisitor = (node: ts.Node) => boolean;

export type CallableTypeScriptFunctionOwnerVisitor = (node: ts.Node, owner: ts.Node) => void;

export type TypeScriptAstNodeCollection = {
	type_aliases: readonly ts.TypeAliasDeclaration[];
	return_statements: readonly ts.ReturnStatement[];
	function_like: readonly ts.SignatureDeclaration[];
	declaration_candidates: readonly ts.Node[];
};
