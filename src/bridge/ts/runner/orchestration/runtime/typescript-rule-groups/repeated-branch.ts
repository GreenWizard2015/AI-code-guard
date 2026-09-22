import ts from 'typescript';
import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { Branch } from 'src/bridge/ts/runner/orchestration/runtime/types';

/** Responsibilities: _collection repeated TypeScript branch_. **/
export class RepeatedBranch {
	private readonly comparison_kinds = new Set([
		ts.SyntaxKind.EqualsEqualsEqualsToken,
		ts.SyntaxKind.EqualsEqualsToken,
	]);

	/** Responsibilities: _creation violations repeated branch_. **/
	private branch_violations(file: string, branches: Branch[]): Violation[] {
		const branch_names = new Set(branches.map(branch => branch.name));
		if (branches.length < 2) {
			return [];
		}
		if (branch_names.size !== 1) {
			return [];
		}
		const first_branch = branches[0];
		const rule = new DiagnosticRule('branch-duplication');
		return [rule.violation(file, first_branch.line)];
	}

	/** Responsibilities: _collection normalization branch names_. **/
	private collect_branches(node: ts.IfStatement, source_file: ts.SourceFile): Branch[] {
		const branches: Branch[] = [];
		let current: ts.IfStatement | undefined = node;
		while (current) {
			if (!this.append_branch(branches, current, source_file)) {
				break;
			}
			const next: ts.Statement | undefined = current.elseStatement;
			if (next === undefined || !ts.isIfStatement(next)) {
				break;
			}
			current = next;
		}
		return branches;
	}

	/** Responsibilities: _aggregation normalization branch its_. **/
	private append_branch(
		branches: Branch[],
		node: ts.IfStatement,
		source_file: ts.SourceFile
	): boolean {
		const name = this.comparison_name(node.expression);
		if (!name) {
			return false;
		}
		branches.push({
			line: source_file.getLineAndCharacterOfPosition(node.getStart()).line + 1,
			name,
		});
		return true;
	}

	/** Responsibilities: _nested branch statements traversal_. **/
	private visit_branch(
		node: ts.Node,
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		visit: (node: ts.Node) => void
	): void {
		if (ts.isIfStatement(node)) {
			violations.push(...this.branch_violations(file, this.collect_branches(node, source_file)));
		}
		ts.forEachChild(node, visit);
	}

	/** Responsibilities: _resolution compared identifier name_. **/
	public comparison_name(expression: ts.Expression): string {
		if (!ts.isBinaryExpression(expression)) {
			return '';
		}
		if (!this.comparison_kinds.has(expression.operatorToken.kind)) {
			return '';
		}
		if (ts.isIdentifier(expression.left)) {
			return expression.left.text;
		}
		return '';
	}

	/** Responsibilities: _aggregation repeated-branch violations source_. **/
	public repeated_branch(violations: Violation[], file: string, source_file: ts.SourceFile): void {
		if (source_file.statements.length === 0) {
			return;
		}
		const visit = (node: ts.Node): void =>
			this.visit_branch(node, violations, file, source_file, visit);
		visit(source_file);
	}

}
