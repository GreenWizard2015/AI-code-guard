import ts from "typescript";

import type { TypeScriptAstNodeCollection } from "src/typescript_runtime_types";
import type { TypeScriptAstNodeIndexContract, TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _AST node indexing_, _source traversal collection_. **/
export class TypeScriptAstNodeIndex implements TypeScriptAstNodeIndexContract {
	private readonly traversal: TypeScriptAstTraversalContract;

	/** Responsibilities: _AST node collection_. **/
	private append_node(
		node: ts.Node,
		aliases: ts.TypeAliasDeclaration[],
		returns: ts.ReturnStatement[],
		function_like_nodes: ts.SignatureDeclaration[],
		declaration_candidates: ts.Node[],
	): void {
		if (ts.isTypeAliasDeclaration(node)) {
			aliases.push(node);
		}
		if (ts.isReturnStatement(node)) {
			returns.push(node);
		}
		if (ts.isFunctionLike(node)) {
			function_like_nodes.push(node);
		}
		if (ts.isFunctionDeclaration(node) || ts.isVariableStatement(node) || ts.isImportDeclaration(node)) {
			declaration_candidates.push(node);
		}
	}

	/** Responsibilities: _AST node index initialization_. **/
	public constructor(traversal: TypeScriptAstTraversalContract) {
		this.traversal = traversal;
	}

	/** Responsibilities: _indexed AST node collection_. **/
	public collect(): TypeScriptAstNodeCollection {
		const aliases: ts.TypeAliasDeclaration[] = [];
		const returns: ts.ReturnStatement[] = [];
		const function_like_nodes: ts.SignatureDeclaration[] = [];
		const declaration_candidates: ts.Node[] = [];
		this.traversal.visit((node) =>
			this.append_node(node, aliases, returns, function_like_nodes, declaration_candidates),
		);
		return {
			type_aliases: aliases,
			return_statements: returns,
			function_like: function_like_nodes,
			declaration_candidates,
		};
	}
}
