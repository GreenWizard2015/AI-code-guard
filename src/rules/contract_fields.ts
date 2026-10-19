import type { ViolationContract } from "src/protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { AstClassNode } from "src/types";
import type { AstClassField } from "src/types";
import type { ContractKind } from "src/model/types/types";
import { CONTRACT_FIELDS_RULE_ID, MODULE_INTERFACE_KIND } from "src/constants";

/** Responsibilities: _contract fields identification_, _contract-field violations addition_. **/
export class ContractFields {
	private readonly contract_rule_id = CONTRACT_FIELDS_RULE_ID;

	/** Responsibilities: _requested contract class_. **/
	private is_contract_kind(node: AstClassNode, kind: ContractKind): boolean {
		if (kind === MODULE_INTERFACE_KIND) {
			return node.type_contract === true;
		}
		return node.protocol === true;
	}

	/** Responsibilities: _aggregation violations contract class_. **/
	private append_node_fields(
		violations: ViolationContract[],
		file: string,
		node: AstClassNode,
		kind: ContractKind,
	): void {
		let fields = node.fields;
		if (fields === undefined) {
			fields = [];
		}
		for (const field of fields) {
			if (field.readonly) {
				continue;
			}
			this.append_field(violations, file, node, field, kind);
		}
	}

	/** Responsibilities: _aggregation contract field violation_. **/
	public append_field(
		violations: ViolationContract[],
		file: string,
		node: AstClassNode,
		field: AstClassField,
		kind: ContractKind,
	): void {
		const rule = new DiagnosticRule(this.contract_rule_id);
		violations.push(
			rule.violation(file, field.line, {
				kind,
				class_name: node.name,
				field_name: field.name,
			}),
		);
	}

	/** Responsibilities: _aggregation violations contract fields_. **/
	public append_contract_fields(
		violations: ViolationContract[],
		file: string,
		classes: AstClassNode[],
		kind: ContractKind,
	): void {
		for (const node of classes) {
			if (!this.is_contract_kind(node, kind)) {
				continue;
			}
			this.append_node_fields(violations, file, node, kind);
		}
	}
}
