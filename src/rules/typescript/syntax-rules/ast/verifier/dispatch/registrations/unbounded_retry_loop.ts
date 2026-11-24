import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { RULE_IDS } from "src/linting/constants";
import type { CallableNodePredicate } from "src/rules/typescript/syntax-rules/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _attempt ownership_, _loop continuation policy_. **/
export class UnboundedRetryLoop implements ASTSourceRuleContract {
	/** Responsibilities: _nested loop boundary detection_. **/
	private nested_boundary(current: ts.Node, root: ts.Node): boolean {
		if (current === root) {
			return false;
		}
		if (ts.isFunctionLike(current)) {
			return true;
		}
		return ts.isIterationStatement(current, false);
	}

	/** Responsibilities: _nested operation lookup_. **/
	private contains_node(search_root: ts.Node, predicate: CallableNodePredicate): boolean {
		let found = false;
		const visit = (current: ts.Node): void => {
			if (found || this.nested_boundary(current, search_root)) {
				return;
			}
			if (predicate(current)) {
				found = true;
				return;
			}
			current.forEachChild(visit);
		};
		visit(search_root);
		return found;
	}

	/** Responsibilities: _unbounded attempt detection_. **/
	private has_unbounded_retry(node: ts.WhileStatement): boolean {
		let found = false;
		const visit = (current: ts.Node): void => {
			if (found || this.nested_boundary(current, node)) {
				return;
			}
			if (ts.isTryStatement(current) && this.try_contains_continue(current)) {
				found = true;
				return;
			}
			current.forEachChild(visit);
		};
		visit(node.statement);
		return found;
	}

	/** Responsibilities: _catch continuation pattern_. **/
	private try_contains_continue(node: ts.TryStatement): boolean {
		const catch_clause = node.catchClause;
		if (catch_clause === undefined) {
			return false;
		}
		const has_attempt = this.contains_node(node.tryBlock, ts.isCallExpression);
		if (!has_attempt) {
			return false;
		}
		return this.contains_node(catch_clause.block, ts.isContinueStatement);
	}

	/** Responsibilities: _attempt source markers_. **/
	public active_for(source_code: string): boolean {
		return source_code.includes("while");
	}

	/** Responsibilities: _attempt continuation policy_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		const node = request.node;
		if (!ts.isWhileStatement(node)) {
			return;
		}
		if (node.expression.kind !== ts.SyntaxKind.TrueKeyword) {
			return;
		}
		if (!this.has_unbounded_retry(node)) {
			return;
		}
		request.context.for_node(node).append_rule(RULE_IDS.retry_without_ownership);
	}
}
