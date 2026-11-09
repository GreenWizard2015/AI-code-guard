import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { RULE_IDS } from "src/linting/constants";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { DiagnosticRuleContract } from "src/model/protocols";
import type { RuleContextContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _public state exposure_, _contract implementation field visibility_. **/
export class TypeScriptStateRules implements ASTSourceRuleContract {
	private readonly _contract_field_rule: DiagnosticRuleContract;
	private readonly _contract_getter_rule: DiagnosticRuleContract;
	private readonly _getter_rule: DiagnosticRuleContract;
	private readonly _setter_rule: DiagnosticRuleContract;
	private readonly _public_state_rule: DiagnosticRuleContract;

	/** Responsibilities: _collection type classification_. **/
	private collection_type(type: ts.TypeNode): boolean {
		if (ts.isArrayTypeNode(type)) {
			return true;
		}
		if (!ts.isTypeReferenceNode(type)) {
			return false;
		}
		const type_name = type.typeName.getText(type.getSourceFile());
		return ["Array", "Map", "Set", "Record"].includes(type_name);
	}

	/** Responsibilities: _public parameter property classification_. **/
	private public_parameter(node: ts.ParameterDeclaration): boolean {
		const modifiers = ts.getModifiers(node);
		let exposed = false;
		let hidden = false;
		if (modifiers !== undefined) {
			exposed = modifiers.some(
				(item) => item.kind === ts.SyntaxKind.PublicKeyword || item.kind === ts.SyntaxKind.ReadonlyKeyword,
			);
			hidden = modifiers.some(
				(item) => item.kind === ts.SyntaxKind.PrivateKeyword || item.kind === ts.SyntaxKind.ProtectedKeyword,
			);
		}
		return Boolean(exposed && !hidden);
	}

	/** Responsibilities: _contract member field extraction_. **/
	private contract_member_fields(member: ts.ClassElement): ts.Node[] {
		if (ts.isConstructorDeclaration(member)) {
			return member.parameters.filter((parameter) => this.public_parameter(parameter));
		}
		if (!ts.isPropertyDeclaration(member) || !this.contract_property_visible(member)) {
			return [];
		}
		return [member];
	}

	/** Responsibilities: _contract property visibility_. **/
	private contract_property_visible(member: ts.PropertyDeclaration): boolean {
		if (ts.isPrivateIdentifier(member.name)) {
			return false;
		}
		for (const modifier of member.modifiers ?? []) {
			if (modifier.kind === ts.SyntaxKind.PrivateKeyword) {
				return false;
			}
			if (modifier.kind === ts.SyntaxKind.ProtectedKeyword) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _public collection field eligibility_. **/
	private public_collection_field(node: ts.PropertyDeclaration): boolean {
		if (ts.isPrivateIdentifier(node.name)) {
			return false;
		}
		for (const modifier of node.modifiers ?? []) {
			if (modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword) {
				return false;
			}
			if (modifier.kind === ts.SyntaxKind.ReadonlyKeyword) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _implemented class field selection_. **/
	private implemented_class_fields(node: ts.ClassDeclaration): ts.Node[] {
		let implements_contract = false;
		const heritage_clauses = node.heritageClauses;
		if (heritage_clauses !== undefined) {
			implements_contract = heritage_clauses.some((clause) => clause.token === ts.SyntaxKind.ImplementsKeyword);
		}
		if (!implements_contract) {
			return [];
		}
		return node.members.flatMap((member) => this.contract_member_fields(member));
	}

	/** Responsibilities: _public collection property exposure_. **/
	private collection_property_rules(
		property_candidate: ts.Node,
		test_file: boolean,
	): readonly DiagnosticRuleContract[] {
		if (test_file || !ts.isPropertyDeclaration(property_candidate)) {
			return [];
		}
		if (!this.public_collection_field(property_candidate)) {
			return [];
		}
		if (property_candidate.type === undefined || !this.collection_type(property_candidate.type)) {
			return [];
		}
		return [this._public_state_rule];
	}

	/** Responsibilities: _member-level rule selection_. **/
	private member_rules(member_candidate: ts.Node, test_file: boolean): readonly DiagnosticRuleContract[] {
		if (ts.isSetAccessor(member_candidate)) {
			return [this._setter_rule];
		}
		if (ts.isGetAccessor(member_candidate)) {
			if (ts.isInterfaceDeclaration(member_candidate.parent) && !test_file) {
				return [];
			}
			return [this._getter_rule];
		}
		return this.collection_property_rules(member_candidate, test_file);
	}

	/** Responsibilities: _contract implementation field diagnostics_. **/
	private append_contract_fields(class_declaration: ts.ClassDeclaration, class_context: RuleContextContract): void {
		class_context
			.state()
			.analysis.stage_timer.measure("rule.public-field-on-contract-implementation.typescript", () => {
				for (const field of this.implemented_class_fields(class_declaration)) {
					class_context.for_node(field).append_diagnostic_rule(this._contract_field_rule);
				}
			});
	}

	/** Responsibilities: _contract accessor diagnostics_. **/
	private append_contract_getters(
		contract_declaration: ts.InterfaceDeclaration,
		contract_context: RuleContextContract,
	): void {
		contract_context.state().analysis.stage_timer.measure("rule.typescript-contract-getter", () => {
			for (const getter of contract_declaration.members.filter(ts.isGetAccessorDeclaration)) {
				contract_context.for_node(getter).append_diagnostic_rule(this._contract_getter_rule);
			}
		});
	}

	/** Responsibilities: _member diagnostic materialization_. **/
	private append_member_rules(accessor_node: ts.Node, context: RuleContextContract): void {
		for (const rule of this.member_rules(accessor_node, context.state().source.test_file)) {
			context.for_node(accessor_node).append_diagnostic_rule(rule);
		}
	}

	/** Responsibilities: _getter diagnostic timing_. **/
	private append_getter_diagnostics(getter_candidate: ts.Node, getter_context: RuleContextContract): boolean {
		return getter_context.state().analysis.stage_timer.measure(`rule.${RULE_IDS.typescript_getter}`, () => {
			if (!ts.isGetAccessor(getter_candidate)) {
				return false;
			}
			this.append_member_rules(getter_candidate, getter_context);
			return true;
		});
	}

	/** Responsibilities: _setter diagnostic timing_. **/
	private append_setter_diagnostics(setter_candidate: ts.Node, setter_context: RuleContextContract): boolean {
		return setter_context.state().analysis.stage_timer.measure(`rule.${RULE_IDS.typescript_setter}`, () => {
			if (!ts.isSetAccessor(setter_candidate)) {
				return false;
			}
			this.append_member_rules(setter_candidate, setter_context);
			return true;
		});
	}

	/** Responsibilities: _accessor diagnostics_. **/
	private append_member_diagnostics(accessor_candidate: ts.Node, member_context: RuleContextContract): void {
		if (this.append_getter_diagnostics(accessor_candidate, member_context)) {
			return;
		}
		if (this.append_setter_diagnostics(accessor_candidate, member_context)) {
			return;
		}
		for (const rule of this.member_rules(accessor_candidate, member_context.state().source.test_file)) {
			member_context.for_node(accessor_candidate).append_diagnostic_rule(rule);
		}
	}

	/** Responsibilities: _state rule setup_. **/
	public constructor() {
		this._contract_field_rule = new DiagnosticRule(RULE_IDS.public_field_on_contract_implementation);
		this._contract_getter_rule = new DiagnosticRule(RULE_IDS.typescript_contract_getter);
		this._getter_rule = new DiagnosticRule(RULE_IDS.typescript_getter);
		this._setter_rule = new DiagnosticRule(RULE_IDS.typescript_setter);
		this._public_state_rule = new DiagnosticRule(RULE_IDS.public_state_exposure);
	}

	/** Responsibilities: _state rule activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _state node verification_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		const { node, context } = request;
		if (ts.isClassDeclaration(node)) {
			this.append_contract_fields(node, context);
			return;
		}
		if (ts.isInterfaceDeclaration(node)) {
			this.append_contract_getters(node, context);
			return;
		}
		this.append_member_diagnostics(node, context);
	}
}
