import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { MAX_CALLABLE_BRANCHES } from "src/constants";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { DiagnosticRuleContract } from "src/model/protocols";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _callable branch analysis_, _branch count reporting_. **/
export class TypeScriptCallableBranchRules implements ASTSourceRuleContract {
	private readonly _rule: DiagnosticRuleContract;
	private readonly _branch_kinds: ReadonlySet<ts.SyntaxKind>;

	/** Responsibilities: _nested callable recognition_. **/
	private callable(node: ts.Node): boolean {
		switch (node.kind) {
			case ts.SyntaxKind.FunctionDeclaration:
			case ts.SyntaxKind.MethodDeclaration:
			case ts.SyntaxKind.Constructor:
			case ts.SyntaxKind.GetAccessor:
			case ts.SyntaxKind.SetAccessor:
				return true;
			default:
				return false;
		}
	}

	/** Responsibilities: _owned callable branch traversal_. **/
	private visit_callable_node(current: ts.Node, root: ts.Node, pending: ts.Node[]): number {
		if (current !== root && ts.isFunctionLike(current)) {
			return 0;
		}
		const count = this._branch_kinds.has(current.kind) ? 1 : 0;
		current.forEachChild((child) => {
			pending.push(child);
		});
		return count;
	}

	/** Responsibilities: _callable branch count_. **/
	private branch_count(root: ts.Node): number {
		let count = 0;
		const pending = [root];
		while (pending.length > 0) {
			const current = pending.pop();
			if (current !== undefined) {
				count += this.visit_callable_node(current, root, pending);
			}
		}
		return count;
	}

	/** Responsibilities: _branch diagnostic_. **/
	private append(request: TypeScriptNodeVerificationRequest): void {
		const { node, context } = request;
		if (context.state().source.test_file) {
			return;
		}
		if (this.branch_count(node) <= MAX_CALLABLE_BRANCHES) {
			return;
		}
		const source_file = context.state().source.source_file;
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1;
		const violation = this._rule.violation(context.state().source.file, line, {});
		context.append_violation(violation);
	}

	/** Responsibilities: _branch verifier initialization_. **/
	public constructor() {
		this._rule = new DiagnosticRule("callable-branch-count");
		this._branch_kinds = new Set([
			ts.SyntaxKind.IfStatement,
			ts.SyntaxKind.ForStatement,
			ts.SyntaxKind.ForInStatement,
			ts.SyntaxKind.ForOfStatement,
			ts.SyntaxKind.WhileStatement,
			ts.SyntaxKind.DoStatement,
			ts.SyntaxKind.CaseClause,
			ts.SyntaxKind.DefaultClause,
			ts.SyntaxKind.ConditionalExpression,
			ts.SyntaxKind.CatchClause,
		]);
	}

	/** Responsibilities: _branch rule activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _callable branch owner dispatch_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (this.callable(request.node)) {
			this.append(request);
		}
	}
}
