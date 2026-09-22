import { PointlessExpression } from 'src/rules/typescript/pointless-expression';
import { TypeScriptAssignmentAnalysis } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/typescript-assignment-analysis';
import ts from 'typescript';
import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { Assignment } from 'src/types';



/** Responsibilities: _pointless assignments identification_, _assignment violations addition_. **/
export class PointlessAssignments {
	private readonly assignment_rule_id = 'pointless-assignment';
	private readonly script_assignment_analysis = new TypeScriptAssignmentAnalysis();
	private readonly pointless_expression = new PointlessExpression();

	/** Responsibilities: _assignment candidates collection_, _output names validation_. **/
	private append_statement(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		statement: ts.Statement,
		candidates: Assignment[]
	): Assignment[] {
		const assignments = this.script_assignment_analysis.assignment_value(statement, source_file);
		if (assignments.length > 0) {
			return [...candidates, assignments[0]];
		}
		this.append_returns(violations, file, candidates, this.pointless_expression.returned_names_from(statement));
		return [];
	}

	/** Responsibilities: _aggregation violations pointless output_. **/
	private append_returns(
		violations: Violation[],
		file: string,
		candidates: Assignment[],
		returned_names: string[]
	): void {
		for (const returned_name of returned_names) {
			if (candidates.length === 0) {
				continue;
			}
			if (!this.script_assignment_analysis.pointless_assignment(candidates, returned_name)) {
				continue;
			}
			const rule = new DiagnosticRule(this.assignment_rule_id);
			violations.push(rule.violation(file, candidates[0].line + 1));
		}
	}

	/** Responsibilities: _analysis assignments callable_. **/
	public append_callable(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		body: ts.Block
	): void {
		let candidates: Assignment[] = [];
		for (const statement of body.statements) {
			candidates = this.append_statement(violations, file, source_file, statement, candidates);
		}
	}

	/** Responsibilities: _analysis callable assignments source_. **/
	public append_assignment_violations(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile
	): void {
		if (source_file.statements.length === 0) {
			return;
		}
		const visit = (node: ts.Node): void => {
			if (!ts.isFunctionLike(node) || !('body' in node)) {
				ts.forEachChild(node, visit);
				return;
			}
			if (node.body === undefined || node.body === null || (!ts.isBlock(node.body))) {
				ts.forEachChild(node, visit);
				return;
			}
			this.append_callable(violations, file, source_file, node.body);
			ts.forEachChild(node, visit);
		};
		visit(source_file);
	}
}
