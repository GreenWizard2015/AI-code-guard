import { CONTRACT_FIELDS_RULE_ID, MODULE_INTERFACE_KIND } from "src/constants";
import type { AstClassNode } from "src/model/ast/normalized_ast_types";
import type { AstClassField } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { StructuralDeclarationKind } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _contract fields identification_, _contract-field violations addition_. **/
export class StructuralFieldRules {
	private readonly _file: string;
	private readonly _classes: readonly AstClassNode[];
	private readonly _kind: StructuralDeclarationKind;
	private readonly _contract_rule_id: string;

	/** Responsibilities: _requested contract class_. **/
	private is_contract_kind(class_node: AstClassNode, kind: StructuralDeclarationKind): boolean {
		if (kind === MODULE_INTERFACE_KIND) {
			return class_node.classification.type_contract === true;
		}
		return class_node.classification.protocol === true;
	}

	/** Responsibilities: _aggregation violations contract class_. **/
	private append_node_fields(node_violations: ViolationContract[], field_owner: AstClassNode): void {
		let fields = field_owner.field_analysis.fields;
		if (fields === undefined) {
			fields = [];
		}
		for (const field of fields) {
			if (field.readonly && this._kind !== MODULE_INTERFACE_KIND) {
				continue;
			}
			this.append_field(node_violations, this._file, field_owner, field, this._kind);
		}
	}

	/** Responsibilities: _source contract-field analysis initialization_. **/
	public constructor(file: string, classes: readonly AstClassNode[], kind: StructuralDeclarationKind) {
		this._contract_rule_id = CONTRACT_FIELDS_RULE_ID;
		this._file = file;
		this._classes = classes;
		this._kind = kind;
	}

	/** Responsibilities: _aggregation contract field violation_. **/
	public append_field(
		field_violations: ViolationContract[],
		source_file: string,
		class_node: AstClassNode,
		field: AstClassField,
		kind: StructuralDeclarationKind,
	): void {
		const rule = new DiagnosticRule(this._contract_rule_id);
		field_violations.push(
			rule.violation(source_file, field.line, {
				kind,
				field_policy: kind === MODULE_INTERFACE_KIND ? "any" : "mutable",
				class_name: class_node.identity.name,
				field_name: field.name,
			}),
		);
	}

	/** Responsibilities: _aggregation violations contract fields_. **/
	public append_contract_fields(contract_violations: ViolationContract[]): void {
		for (const node of this._classes) {
			if (!this.is_contract_kind(node, this._kind)) {
				continue;
			}
			this.append_node_fields(contract_violations, node);
		}
	}
}
