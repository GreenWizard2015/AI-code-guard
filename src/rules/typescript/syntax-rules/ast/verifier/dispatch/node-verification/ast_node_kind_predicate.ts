import { ASTAncestorRelation } from "src/ast_verifier_protocols";
import type { ASTPredicateContract } from "src/ast_verifier_protocols";
import type ts from "typescript";

/** Responsibilities: _AST node-kind matching_, _outer-node selection_, _registration indexing_. **/
export class ASTNodeKindPredicate implements ASTPredicateContract {
	private readonly _kind: ts.SyntaxKind;
	private readonly _relation_to_outer: ASTAncestorRelation;

	/** Responsibilities: _AST node-kind predicate configuration_. **/
	public constructor(kind: ts.SyntaxKind, relation_to_outer: ASTAncestorRelation) {
		this._kind = kind;
		this._relation_to_outer = relation_to_outer;
	}

	/** Responsibilities: _AST node-kind identity_. **/
	public node_kind(): ts.SyntaxKind {
		return this._kind;
	}

	/** Responsibilities: _AST node-kind matching_. **/
	public matches_node_kind(kind: ts.SyntaxKind): boolean {
		return this._kind === kind;
	}

	/** Responsibilities: _ancestor node candidates_. **/
	public *outer_candidates(node: ts.Node): IterableIterator<ts.Node> {
		let ancestor = node.parent;
		if (this._relation_to_outer === ASTAncestorRelation.Parent) {
			if (ancestor !== undefined) {
				yield ancestor;
			}
			return;
		}
		while (ancestor !== undefined) {
			yield ancestor;
			ancestor = ancestor.parent;
		}
	}
}
