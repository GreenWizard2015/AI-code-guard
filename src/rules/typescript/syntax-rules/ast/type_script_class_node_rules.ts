import { DeclarationPredicates } from "src/parser/analysis/declaration_predicates";
import { PrototypePredicates } from "src/rules/typescript/syntax-rules/runtime/prototype_predicates";
import type { TypeScriptClassNodeRulesContract, ValueRulesContract } from "src/protocols";
import type { RuleContextData } from "src/types";
import ts from "typescript";
import { RULE_IDS } from "src/constants";

/** Responsibilities: _TypeScript declaration rules_, _class field rules_. **/
export class TypeScriptClassNodeRules implements TypeScriptClassNodeRulesContract {
	private readonly declaration_predicates: DeclarationPredicates;
	private readonly prototype_predicates: PrototypePredicates;
	private readonly value_rules: ValueRulesContract;
	private readonly rule_ids = {
		static_method: RULE_IDS.typescript_static_method,
		static_field: RULE_IDS.typescript_static_field,
		prototype_assignment: RULE_IDS.typescript_prototype_assignment,
		dynamic_type: RULE_IDS.dynamic_type,
		temporary_result_access: RULE_IDS.temporary_result_access,
		complex_constructor: RULE_IDS.complex_constructor,
		field_in_constructor: RULE_IDS.field_in_constructor,
		empty_contract: RULE_IDS.empty_contract,
		explicit_visibility: RULE_IDS.typescript_explicit_visibility,
		mutable_field: RULE_IDS.typescript_mutable_field,
	};

	/** Responsibilities: _declaration rule identifiers_. **/
	private declaration_rule_ids(node: ts.Node): string[] {
		const rule_ids: string[] = [];
		rule_ids.push(...this.empty_rule_ids(node));
		rule_ids.push(...this.static_rule_ids(node));
		if (this.prototype_predicates.prototype_assignment(node)) {
			rule_ids.push(this.rule_ids.prototype_assignment);
		}
		if (this.declaration_predicates.temporary_result_access(node)) {
			rule_ids.push(this.rule_ids.temporary_result_access);
		}
		if (this.declaration_predicates.complex_constructor(node)) {
			rule_ids.push(this.rule_ids.complex_constructor);
		}
		if (this.declaration_predicates.complex_field(node)) {
			rule_ids.push(this.rule_ids.field_in_constructor);
		}
		return rule_ids;
	}

	/** Responsibilities: _empty contract rule identification_. **/
	private empty_rule_ids(node: ts.Node): string[] {
		if (ts.isInterfaceDeclaration(node) && node.members.length === 0 && node.heritageClauses === undefined) {
			return [this.rule_ids.empty_contract];
		}
		return [];
	}

	/** Responsibilities: _static declaration rule identifiers_. **/
	private static_rule_ids(node: ts.Node): string[] {
		if (!this.declaration_predicates.static_declaration(node)) {
			return [];
		}
		if (ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)) {
			return [this.rule_ids.static_method];
		}
		if (ts.isPropertyDeclaration(node)) {
			return [this.rule_ids.static_field];
		}
		return [];
	}

	/** Responsibilities: _field rule identifiers_. **/
	private field_rule_ids(node: ts.Node, context: RuleContextData): string[] {
		const rule_ids: string[] = [];
		if (context.class_fields.missing_visibility(node, context.file)) {
			rule_ids.push(this.rule_ids.explicit_visibility);
		}
		if (context.class_fields.mutable_field(node, context.file)) {
			rule_ids.push(this.rule_ids.mutable_field);
		}
		return rule_ids;
	}

	/** Responsibilities: _call-site rule ownership_. **/
	private append_call_rules(node: ts.CallExpression, context: RuleContextData): void {
		if (this.prototype_predicates.prototype_assignment(node)) {
			context.append_rule(node, this.rule_ids.prototype_assignment);
		}
		if (this.declaration_predicates.temporary_result_access(node)) {
			context.append_rule(node, this.rule_ids.temporary_result_access);
		}
		if (this.value_rules.dynamic_class(node)) {
			context.append_rule(node, this.rule_ids.dynamic_type);
		}
	}

	/** Responsibilities: _prototype class rules_. **/
	private append_prototype_rules(node: ts.Node, context: RuleContextData): void {
		if (this.prototype_predicates.prototype_assignment(node)) {
			context.append_rule(node, this.rule_ids.prototype_assignment);
		}
	}

	/** Responsibilities: _declaration class rules_. **/
	private append_declaration_rules(node: ts.Node, context: RuleContextData): void {
		const rule_ids = this.declaration_rule_ids(node);
		rule_ids.push(...this.field_rule_ids(node, context));
		if (this.value_rules.dynamic_class(node)) {
			rule_ids.push(this.rule_ids.dynamic_type);
		}
		for (const rule_id of rule_ids) {
			context.append_rule(node, rule_id);
		}
	}

	/** Responsibilities: _class rule dependency initialization_. **/
	public constructor(value_rules: ValueRulesContract) {
		this.declaration_predicates = new DeclarationPredicates();
		this.prototype_predicates = new PrototypePredicates();
		this.value_rules = value_rules;
	}

	/** Responsibilities: _class node rules_. **/
	public append(node: ts.Node, context: RuleContextData): void {
		if (ts.isCallExpression(node)) {
			this.append_call_rules(node, context);
			return;
		}
		if (ts.isBinaryExpression(node) || ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
			this.append_prototype_rules(node, context);
			return;
		}
		this.append_declaration_rules(node, context);
	}
}
