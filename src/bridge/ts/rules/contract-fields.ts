import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { AstClassNode } from 'src/types';
import type { NamedLine } from 'src/types';
import type { ContractKind } from 'src/bridge/ts/rules/types';

/** Responsibilities: _contract fields identification_, _contract-field violations addition_. **/
export class ContractFields {
	private readonly contract_rule_id = 'contract-fields';

	/** Responsibilities: _requested contract class_. **/
	private is_contract_kind(node: AstClassNode, kind: ContractKind): boolean {
		if (kind === 'interface') {
			return node.type_contract === true;
		}
		return node.protocol === true;
	}

	/** Responsibilities: _aggregation violations contract class_. **/
	private append_node_fields(
		violations: Violation[],
		file: string,
		node: AstClassNode,
		kind: ContractKind
	): void {
		let fields = node.fields;
		if (fields === undefined) {
			fields = [];
		}
		for (const field of fields) {
			this.append_field(violations, file, node, field, kind);
		}
	}

	/** Responsibilities: _aggregation contract field violation_. **/
	public append_field(
		violations: Violation[],
		file: string,
		node: AstClassNode,
		field: NamedLine,
		kind: ContractKind
	): void {
		const rule = new DiagnosticRule(this.contract_rule_id);
		violations.push(
			rule.violation(file, field.line, {
				kind,
				class_name: node.name,
				field_name: field.name,
			})
		);
	}

	/** Responsibilities: _aggregation violations contract fields_. **/
	public append_contract_fields(
		violations: Violation[],
		file: string,
		classes: AstClassNode[],
		kind: ContractKind
	): void {
		for (const node of classes) {
			if (!this.is_contract_kind(node, kind)) {
				continue;
			}
			this.append_node_fields(violations, file, node, kind);
		}
	}
}
