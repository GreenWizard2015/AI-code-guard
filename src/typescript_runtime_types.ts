import type ts from "typescript";

/** Responsibilities: _AST traversal node data_. **/
export type TypeScriptAstTraversalNode = {
	node: ts.Node;
	inside_constructor: boolean;
	owner: string;
	function_owner: ts.Node;
};

export type TypeScriptAstTraversalVisitor = (node: ts.Node, inside_constructor: boolean, owner: string) => void;

export type TypeScriptFunctionOwnerVisitor = (node: ts.Node, owner: ts.Node) => void;

export type TypeScriptAstNodeCollection = {
	type_aliases: readonly ts.TypeAliasDeclaration[];
	return_statements: readonly ts.ReturnStatement[];
	function_like: readonly ts.SignatureDeclaration[];
	declaration_candidates: readonly ts.Node[];
};
