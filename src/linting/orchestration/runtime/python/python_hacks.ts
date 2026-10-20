import { DiagnosticRule } from "src/model/diagnostic_rule";
import { RULE_IDS } from "src/constants";
import type { PythonHacksContract } from "src/python_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { AstCallableNodeContract, AstStatementNode } from "src/types";

import type { PythonAssignment, ReturnViolationContext, StatementContext } from "src/model/types/types";

/** Responsibilities: _pointless operations_, _assignment forms_. **/
export class PythonHacks implements PythonHacksContract {
	private readonly pointless_rule_id = RULE_IDS.pointless_assignment;

	/** Responsibilities: _normalization assignment statement conversion_. **/
	private assignment_candidate(statement: AstStatementNode): PythonAssignment[] {
		if (statement.kind !== "assignment") {
			return [];
		}
		if (!statement.name) {
			return [];
		}
		return [
			{
				line: statement.line,
				name: statement.name,
				simple_alias: Boolean(statement.simple_alias),
				destructured: Boolean(statement.destructured),
			},
		];
	}

	/** Responsibilities: _aggregation violation pointless output_. **/
	private append_return_violation(context: ReturnViolationContext): void {
		const { violations, file, candidates, kind, name } = context;
		if (kind !== "return") {
			return;
		}
		if (!name) {
			return;
		}
		if (!this.is_pointless_return(candidates, name)) {
			return;
		}
		const rule = new DiagnosticRule(this.pointless_rule_id);
		violations.push(rule.violation(file, candidates[0].line + 1));
	}

	/** Responsibilities: _classification output repeats prior_. **/
	private is_pointless_return(candidates: PythonAssignment[], name: string): boolean {
		if (candidates.length === 0) {
			return false;
		}
		if (candidates.length === 1) {
			return candidates[0].name === name;
		}
		if (candidates[0].destructured) {
			return false;
		}
		if (candidates[candidates.length - 1].name !== name) {
			return false;
		}
		return candidates.slice(1).every((candidate) => candidate.simple_alias);
	}

	/** Responsibilities: _classification aggregation violations Python_. **/
	public append_statement(context: StatementContext): void {
		const { violations, file, candidates, statement } = context;
		const { kind, name } = statement;
		const assignment = this.assignment_candidate(statement);
		if (assignment.length > 0) {
			candidates.push(...assignment);
			return;
		}
		this.append_return_violation({ violations, file, candidates, kind, name });
		candidates.length = 0;
	}

	/** Responsibilities: _aggregation pointless-assignment violations callable_. **/
	public append_assignment_violations(
		violations: ViolationContract[],
		file: string,
		callables: AstCallableNodeContract[],
	): void {
		for (const callable of callables) {
			const candidates: PythonAssignment[] = [];
			let statements = callable.statements;
			if (statements === undefined) {
				statements = [];
			}
			for (const statement of statements) this.append_statement({ violations, file, candidates, statement });
		}
	}
}
