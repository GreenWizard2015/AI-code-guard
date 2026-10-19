import ts from "typescript";
import type { ViolationContract } from "src/protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { Branch } from "src/model/types/types";
import type {
	RepeatedBranchSummary,
	RepeatedBranchVisitState,
} from "src/linting/orchestration/runtime/typescript-rule-groups/types";

/** Responsibilities: _branch chain analysis_, _duplicate branch diagnostics_. **/
export class RepeatedBranch {
	private readonly comparison_kinds: Set<ts.SyntaxKind>;

	/** Responsibilities: _creation violations repeated branch_. **/
	private branch_violations(file: string, summary: RepeatedBranchSummary): ViolationContract[] {
		if (summary.length < 2) {
			return [];
		}
		if (!summary.all_same) {
			return [];
		}
		const rule = new DiagnosticRule("branch-duplication");
		return [rule.violation(file, summary.line)];
	}

	/** Responsibilities: _collection branch-chain summaries_. **/
	/** Responsibilities: _collection branch-chain nodes_. **/
	private append_chain_nodes(node: ts.IfStatement, nodes: ts.IfStatement[]): void {
		const name = this.comparison_name(node.expression);
		if (name.length === 0) {
			return;
		}
		nodes.push(node);
		const next = node.elseStatement;
		if (next === undefined) {
			return;
		}
		if (!ts.isIfStatement(next)) {
			return;
		}
		this.append_chain_nodes(next, nodes);
	}

	/** Responsibilities: _collection branch-chain nodes_. **/
	private chain_nodes(node: ts.IfStatement): ts.IfStatement[] {
		const nodes: ts.IfStatement[] = [];
		this.append_chain_nodes(node, nodes);
		return nodes;
	}

	/** Responsibilities: _branch comparison equality_. **/
	private branch_names_same(nodes: readonly ts.IfStatement[]): boolean {
		const names = new Set<string>();
		for (const node of nodes) {
			names.add(this.comparison_name(node.expression));
		}
		return names.size === 1;
	}

	/** Responsibilities: _branch summary storage_. **/
	private append_branch_summaries(
		nodes: readonly ts.IfStatement[],
		state: RepeatedBranchVisitState,
		all_same: boolean,
	): void {
		for (let index = nodes.length - 1; index >= 0; index -= 1) {
			const current = nodes[index];
			if (current === undefined) {
				continue;
			}
			const branch: Branch = {
				line: state.source_file.getLineAndCharacterOfPosition(current.getStart()).line + 1,
				name: this.comparison_name(current.expression),
			};
			state.summaries.set(current, {
				length: nodes.length - index,
				all_same,
				line: branch.line,
			});
		}
	}

	/** Responsibilities: _nested branch statements traversal_. **/
	private visit_branch(node: ts.Node, state: RepeatedBranchVisitState): void {
		if (ts.isIfStatement(node)) {
			if (!state.summaries.has(node)) {
				const nodes = this.chain_nodes(node);
				this.append_branch_summaries(nodes, state, this.branch_names_same(nodes));
			}
			const summary = state.summaries.get(node);
			if (summary !== undefined) {
				state.violations.push(...this.branch_violations(state.file, summary));
			}
		}
		ts.forEachChild(node, (child) => this.visit_branch(child, state));
	}

	/** Responsibilities: _resolution compared identifier name_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.comparison_kinds = new Set([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken]);
	}
	/** Responsibilities: _public operation_. **/
	public comparison_name(expression: ts.Expression): string {
		if (!ts.isBinaryExpression(expression)) {
			return "";
		}
		if (!this.comparison_kinds.has(expression.operatorToken.kind)) {
			return "";
		}
		if (ts.isIdentifier(expression.left)) {
			return expression.left.text;
		}
		return "";
	}

	/** Responsibilities: _aggregation repeated-branch violations source_. **/
	public repeated_branch(violations: ViolationContract[], file: string, source_file: ts.SourceFile): void {
		if (source_file.statements.length === 0) {
			return;
		}
		const state: RepeatedBranchVisitState = {
			violations,
			file,
			source_file,
			summaries: new WeakMap<ts.IfStatement, RepeatedBranchSummary>(),
		};
		this.visit_branch(source_file, state);
	}
}
