import type {
	ASTNodeVerificationContract,
	ASTPredicateContract,
	ASTVerifierNodeGroupContract,
	ASTVerifierNodeRegistrationContract,
} from "src/ast_verifier_protocols";
import { EMPTY_PATH_MESSAGE } from "src/constants";
import { ASTVerifierNodeGroup } from "src/rules/typescript/syntax-rules/ast/verifier/dispatch/ast_verifier_node_group";
import type ts from "typescript";

/** Responsibilities: _AST verifier path matching_, _predicate path ownership_. **/
export class ASTVerifierPath implements ASTVerifierNodeRegistrationContract {
	private readonly _predicates: readonly ASTPredicateContract[];
	private readonly _verifier: ASTNodeVerificationContract;

	/** Responsibilities: _recursive AST path match_. **/
	private is_prefix_match(node: ts.Node, inner_index: number): boolean {
		const inner_predicate = this._predicates[inner_index];
		if (inner_predicate === undefined || !inner_predicate.matches_node_kind(node.kind)) {
			return false;
		}
		if (inner_index === 0) {
			return true;
		}
		const outer_predicate = this._predicates[inner_index - 1];
		if (outer_predicate === undefined) {
			return false;
		}
		for (const ancestor of inner_predicate.outer_candidates(node)) {
			if (outer_predicate.matches_node_kind(ancestor.kind) && this.is_prefix_match(ancestor, inner_index - 1)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _AST verifier path initialization_. **/
	public constructor(predicates: readonly ASTPredicateContract[], verifier: ASTNodeVerificationContract) {
		const terminal_predicate = predicates.at(-1);
		if (terminal_predicate === undefined) {
			throw new Error(EMPTY_PATH_MESSAGE);
		}
		this._predicates = [...predicates];
		this._verifier = verifier;
	}

	/** Responsibilities: _node-kind verifier indexing_. **/
	public node_kind(): ts.SyntaxKind {
		const terminal_predicate = this._predicates.at(-1);
		if (terminal_predicate === undefined) {
			throw new Error(EMPTY_PATH_MESSAGE);
		}
		return terminal_predicate.node_kind();
	}

	/** Responsibilities: _direct node-kind path classification_. **/
	public kind_only(): boolean {
		return this._predicates.length === 1;
	}

	/** Responsibilities: _verifier path group registration_. **/
	public append_to(candidates: ASTVerifierNodeGroupContract[]): void {
		for (const candidate of candidates) {
			if (candidate.shares_verifier(this._verifier)) {
				candidate.append_registration(this);
				return;
			}
		}
		candidates.push(new ASTVerifierNodeGroup(this._verifier, this));
	}

	/** Responsibilities: _AST verifier path match_. **/
	public matches_node(target: ts.Node): boolean {
		return this.is_prefix_match(target, this._predicates.length - 1);
	}
}
