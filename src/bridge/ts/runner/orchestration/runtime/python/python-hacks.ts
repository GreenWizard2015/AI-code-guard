import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { AstCallableNode, AstStatementNode } from 'src/types';

import type { PythonAssignment, ReturnViolationContext, StatementContext } from 'src/bridge/ts/runner/orchestration/runtime/types';

/** Responsibilities: _detection pointless Python assignments_. **/
export class PythonHacks {
	private readonly pointless_rule_id = 'pointless-assignment';

	/** Responsibilities: _normalization assignment statement conversion_. **/
	private assignment_candidate(statement: AstStatementNode): PythonAssignment[] {
		if (statement.kind !== 'assignment' || !statement.name) {
			return [];
		}
		return [{
			line: statement.line,
			name: statement.name,
			simple_alias: Boolean(statement.simple_alias),
			destructured: Boolean(statement.destructured),
		}];
	}

	/** Responsibilities: _aggregation violation pointless output_. **/
	private append_return_violation(context: ReturnViolationContext): void {
		const { violations, file, candidates, kind, name } = context;
		if (kind !== 'return' || (!name) || (!this.is_pointless_return(candidates, name))) {
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
if (candidates[0].destructured || candidates[candidates.length - 1].name !== name) {
			return false;
		}
		return candidates.slice(1).every(candidate => candidate.simple_alias);
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
		violations: Violation[],
		file: string,
		callables: AstCallableNode[]
	): void {
		for (const callable of callables) {
			const candidates: PythonAssignment[] = [];
			let statements = callable.statements;
			if (statements === undefined) {
				statements = [];
			}
			for (const statement of statements)
				this.append_statement({ violations, file, candidates, statement });
		}
	}
}
