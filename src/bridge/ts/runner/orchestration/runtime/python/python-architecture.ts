import { ContractFields } from 'src/bridge/ts/rules/contract-fields';
import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { AstClassNode, LineOnly } from 'src/types';


import type { SimpleViolationGroup } from 'src/bridge/ts/runner/orchestration/runtime/python/types';

/** Responsibilities: _reporting Python protocol empty-contract_. **/
export class PythonArchitecture {
	private readonly empty_contract_rule = 'empty-contract';
	private readonly protocol_kind = 'protocol';

	/** Responsibilities: _aggregation empty-contract violation class_. **/
	private append_empty_contract(
		violations: Violation[],
		file: string,
		classes: AstClassNode[]
	): void {
		for (const node of classes) {
			if (!this.empty_protocol(node)) {
				continue;
			}
			this.append_violation(violations, file, node.start + 1, this.empty_contract_rule);
		}
	}

	/** Responsibilities: _aggregation simple architecture violations_. **/
	private append_simple_violations(
		violations: Violation[],
		file: string,
		groups: SimpleViolationGroup[]
	): void {
		for (const group of groups) {
			for (const item of group.items) {
				this.append_violation(violations, file, item.line + 1, group.rule_id);
			}
		}
	}

	/** Responsibilities: _aggregation Python architecture diagnostic_. **/
	private append_violation(
		violations: Violation[],
		file: string,
		line: number,
		rule_id: string
	): void {
		const rule = new DiagnosticRule(rule_id);
		const violation = rule.violation(file, line);
		violations.push(violation);
	}

	/** Responsibilities: _reporting protocol class_. **/
	public empty_protocol(node: AstClassNode): boolean {
		if (!node.protocol) {
			return false;
		}
		if (node.methods.length > 0) {
			return false;
		}
		const field_count = node.fields?.length;
		return field_count !== undefined && field_count === 0;
	}

	/** Responsibilities: _aggregation architecture violations Python_. **/
	public append_architecture_violations(
		violations: Violation[],
		file: string,
		accesses: LineOnly[],
		branches: LineOnly[],
		classes: AstClassNode[]
	): void {
		const contract_fields = new ContractFields();

		this.append_empty_contract(violations, file, classes);
		contract_fields.append_contract_fields(violations, file, classes, this.protocol_kind);
		this.append_simple_violations(violations, file, [
			{ items: accesses, rule_id: 'private-member' },
			{ items: branches, rule_id: 'branch-duplication' },
		]);
	}
}
