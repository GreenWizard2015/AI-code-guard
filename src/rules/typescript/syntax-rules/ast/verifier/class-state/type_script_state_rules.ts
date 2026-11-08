import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { RULE_IDS } from "src/linting/constants";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { DiagnosticRuleContract } from "src/model/protocols";
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
	private collection_property_rules(node: ts.Node, test_file: boolean): readonly DiagnosticRuleContract[] {
		if (test_file || !ts.isPropertyDeclaration(node)) {
			return [];
		}
		if (!this.public_collection_field(node)) {
			return [];
		}
		if (node.type === undefined || !this.collection_type(node.type)) {
			return [];
		}
		return [this._public_state_rule];
	}

	/** Responsibilities: _member-level rule selection_. **/
	private member_rules(node: ts.Node, test_file: boolean): readonly DiagnosticRuleContract[] {
		if (ts.isSetAccessor(node)) {
			return [this._setter_rule];
		}
		if (ts.isGetAccessor(node)) {
			if (ts.isInterfaceDeclaration(node.parent) && !test_file) {
				return [];
			}
			return [this._getter_rule];
		}
		return this.collection_property_rules(node, test_file);
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
			for (const field of this.implemented_class_fields(node)) {
				context.for_node(field).append_diagnostic_rule(this._contract_field_rule);
			}
			return;
		}
		if (ts.isInterfaceDeclaration(node)) {
			for (const getter of node.members.filter(ts.isGetAccessorDeclaration)) {
				context.for_node(getter).append_diagnostic_rule(this._contract_getter_rule);
			}
			return;
		}
		for (const rule of this.member_rules(node, context.state().source.test_file)) {
			context.for_node(node).append_diagnostic_rule(rule);
		}
	}
}
