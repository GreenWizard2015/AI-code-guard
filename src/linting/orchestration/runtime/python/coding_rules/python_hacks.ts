import { PYTHON_ASSIGNMENT_KIND } from "src/linting/orchestration/runtime/python/constants";
import type { AstCallableNode, AstStatementNode } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { DiagnosticRuleContract } from "src/model/protocols";
import type { PythonHacksContract } from "src/python_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";

import type { PythonAssignment, ReturnViolationContext, StatementContext } from "src/model_types";

/** Responsibilities: _pointless operations_, _assignment forms_. **/
export class PythonHacks implements PythonHacksContract {
	private readonly _pointless_rule: DiagnosticRuleContract;
	private readonly _stage_timer: LintStageTimerContract;

	/** Responsibilities: _normalization assignment statement conversion_. **/
	private assignment_candidate(statement: AstStatementNode): PythonAssignment[] {
		if (statement.kind !== PYTHON_ASSIGNMENT_KIND) {
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
		const first_candidate = candidates.at(0);
		if (first_candidate === undefined) {
			return;
		}
		violations.push(this._pointless_rule.violation(file, first_candidate.line + 1, {}));
	}

	/** Responsibilities: _classification output repeats prior_. **/
	private is_pointless_return(candidates: PythonAssignment[], name: string): boolean {
		if (candidates.length === 0) {
			return false;
		}
		const first_candidate = candidates.at(0);
		if (first_candidate === undefined) {
			return false;
		}
		if (candidates.length === 1) {
			return first_candidate.name === name;
		}
		return this.simple_return_chain(candidates, first_candidate, name);
	}

	/** Responsibilities: _simple assignment return chain_. **/
	private simple_return_chain(
		candidates: PythonAssignment[],
		first_candidate: PythonAssignment,
		name: string,
	): boolean {
		const last_candidate = candidates.at(-1);
		if (last_candidate === undefined || first_candidate.destructured) {
			return false;
		}
		if (last_candidate.name !== name) {
			return false;
		}
		return candidates.slice(1).every((candidate) => candidate.simple_alias);
	}

	/** Responsibilities: _pointless assignment rule setup_. **/
	public constructor(pointless_rule_id: string, stage_timer: LintStageTimerContract) {
		this._pointless_rule = new DiagnosticRule(pointless_rule_id);
		this._stage_timer = stage_timer;
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
		candidates.splice(0);
	}

	/** Responsibilities: _aggregation pointless-assignment violations callable_. **/
	public append_assignment_violations(
		violations: ViolationContract[],
		file: string,
		callables: AstCallableNode[],
	): void {
		this._stage_timer.measure("rule.pointless-assignment.python", () => {
			for (const callable of callables) {
				const candidates: PythonAssignment[] = [];
				let statements = callable.signature.statements;
				if (statements === undefined) {
					statements = [];
				}
				for (const statement of statements) {
					this.append_statement({ violations, file, candidates, statement });
				}
			}
		});
	}
}
