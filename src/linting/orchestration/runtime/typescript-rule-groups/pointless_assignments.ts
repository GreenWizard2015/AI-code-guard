import ts from "typescript";
import type { ViolationContract } from "src/reporting_protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { Assignment } from "src/types";
import { TypeScriptCallableBody } from "src/typescript-aliases/callables/type_script_callable_body";
import type { PointlessAssignmentsContract } from "src/analysis_protocols";
import type { PointlessExpressionContract } from "src/shared_services_protocols";
import type { TypeScriptAssignmentAnalysisContract } from "src/typescript_runtime_protocols";
import { RULE_IDS } from "src/constants";

/** Responsibilities: _pointless assignments identification_, _assignment violations addition_. **/
export class PointlessAssignments implements PointlessAssignmentsContract {
	private readonly assignment_rule_id = RULE_IDS.pointless_assignment;
	private readonly script_assignment_analysis: TypeScriptAssignmentAnalysisContract;
	private readonly pointless_expression: PointlessExpressionContract;
	private readonly callable_body: TypeScriptCallableBody;

	/** Responsibilities: _assignment candidates collection_, _output names validation_. **/
	private append_statement(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		statement: ts.Statement,
		candidates: Assignment[],
	): Assignment[] {
		const assignments = this.script_assignment_analysis.assignment_value(statement, source_file);
		if (assignments.length > 0) {
			candidates.push(assignments[0]);
			return candidates;
		}
		this.append_returns(violations, file, candidates, this.pointless_expression.returned_names_from(statement));
		candidates.length = 0;
		return candidates;
	}

	/** Responsibilities: _aggregation violations pointless output_. **/
	private append_returns(
		violations: ViolationContract[],
		file: string,
		candidates: Assignment[],
		returned_names: string[],
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
	/** Responsibilities: _pointless assignment composition_. **/
	public constructor(
		script_assignment_analysis: TypeScriptAssignmentAnalysisContract,
		pointless_expression: PointlessExpressionContract,
	) {
		this.callable_body = new TypeScriptCallableBody();
		this.script_assignment_analysis = script_assignment_analysis;
		this.pointless_expression = pointless_expression;
	}

	/** Responsibilities: _callable assignment collection_. **/
	public append_callable(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		body: ts.Block,
	): void {
		let candidates: Assignment[] = [];
		for (const statement of body.statements) {
			candidates = this.append_statement(violations, file, source_file, statement, candidates);
		}
	}

	/** Responsibilities: _analysis callable assignments source_. **/
	public append_assignment_violations(violations: ViolationContract[], file: string, source_file: ts.SourceFile): void {
		if (source_file.statements.length === 0) {
			return;
		}
		const visit = (node: ts.Node): void => {
			const handled = this.callable_body.resolve(node, false, (body) => {
				if (!ts.isBlock(body)) {
					return false;
				}
				this.append_callable(violations, file, source_file, body);
				return true;
			});
			if (handled) {
				ts.forEachChild(node, visit);
				return;
			}
			ts.forEachChild(node, visit);
		};
		visit(source_file);
	}
}
