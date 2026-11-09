import { RULE_IDS } from "src/linting/constants";
import { TypeScriptClassMemberPolicy } from "src/model/type_script_class_member_policy";
import type { RuleContextContract } from "src/types";
import type {
	TypeScriptBuiltinMutationContract,
	TypeScriptClassDeclarationPredicatesContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _class declaration rules_, _field policy rules_. **/
export class TypeScriptClassDeclarationRuleAnalyzer {
	private readonly _node: ts.Node;
	private readonly _context: RuleContextContract;
	private readonly _declaration_predicates: TypeScriptClassDeclarationPredicatesContract;
	private readonly _prototype_predicates: TypeScriptBuiltinMutationContract;

	/** Responsibilities: _static member rule identification_. **/
	private static_rule_ids(): string[] {
		let rule_id = "";
		if (ts.isMethodDeclaration(this._node) || ts.isGetAccessor(this._node) || ts.isSetAccessor(this._node)) {
			rule_id = RULE_IDS.typescript_static_method;
		} else if (ts.isPropertyDeclaration(this._node)) {
			rule_id = RULE_IDS.typescript_static_field;
		}
		if (rule_id.length === 0) {
			return [];
		}
		const timer = this._context.state().analysis.stage_timer;
		const is_static = timer.measure(`rule.${rule_id}`, () =>
			this._declaration_predicates.static_declaration(this._node),
		);
		if (!is_static) {
			return [];
		}
		return [rule_id];
	}

	/** Responsibilities: _empty interface classification_. **/
	private empty_interface(): boolean {
		if (!ts.isInterfaceDeclaration(this._node)) {
			return false;
		}
		if (this._node.members.length > 0 || this._node.heritageClauses !== undefined) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _state member rule identification_. **/
	private append_member_ids(rule_ids: string[]): void {
		const timer = this._context.state().analysis.stage_timer;
		if (
			timer.measure(`rule.${RULE_IDS.typescript_prototype_assignment}`, () =>
				this._prototype_predicates.prototype_assignment(this._node),
			)
		) {
			rule_ids.push(RULE_IDS.typescript_prototype_assignment);
		}
		if (
			timer.measure(`rule.${RULE_IDS.temporary_result_access}`, () =>
				this._declaration_predicates.temporary_result_access(this._node),
			)
		) {
			rule_ids.push(RULE_IDS.temporary_result_access);
		}
	}

	/** Responsibilities: _constructor state rule identification_. **/
	private append_constructor_ids(rule_ids: string[]): void {
		const timer = this._context.state().analysis.stage_timer;
		if (
			timer.measure(`rule.${RULE_IDS.complex_constructor}`, () =>
				this._declaration_predicates.complex_constructor(this._node),
			)
		) {
			rule_ids.push(RULE_IDS.complex_constructor);
		}
		if (
			timer.measure(`rule.${RULE_IDS.field_in_constructor}`, () =>
				this._declaration_predicates.complex_field(this._node),
			)
		) {
			rule_ids.push(RULE_IDS.field_in_constructor);
		}
	}

	/** Responsibilities: _class declaration analysis initialization_. **/
	public constructor(
		node: ts.Node,
		context: RuleContextContract,
		declaration_predicates: TypeScriptClassDeclarationPredicatesContract,
		prototype_predicates: TypeScriptBuiltinMutationContract,
	) {
		this._node = node;
		this._context = context;
		this._declaration_predicates = declaration_predicates;
		this._prototype_predicates = prototype_predicates;
	}

	/** Responsibilities: _declaration shape rules_. **/
	public shape_rule_ids(): string[] {
		const timer = this._context.state().analysis.stage_timer;
		const rule_ids: string[] = [];
		const is_empty = timer.measure(`rule.${RULE_IDS.empty_contract}`, () => this.empty_interface());
		if (is_empty) {
			rule_ids.push(RULE_IDS.empty_contract);
		}
		rule_ids.push(...this.static_rule_ids());
		return rule_ids;
	}

	/** Responsibilities: _declaration state rules_. **/
	public state_rule_ids(): string[] {
		const rule_ids: string[] = [];
		this.append_member_ids(rule_ids);
		this.append_constructor_ids(rule_ids);
		return rule_ids;
	}

	/** Responsibilities: _field policy rules_. **/
	public field_rule_ids(): string[] {
		const context = this._context;
		const policy = new TypeScriptClassMemberPolicy(this._node, context.state().source.path_kinds);
		const timer = context.state().analysis.stage_timer;
		const state = timer.measure("typescript.class-member-policy", () => policy.state());
		const rule_ids: string[] = [];
		if (timer.measure(`rule.${RULE_IDS.typescript_explicit_visibility}`, () => state.requires_explicit_visibility)) {
			rule_ids.push(RULE_IDS.typescript_explicit_visibility);
		}
		if (timer.measure(`rule.${RULE_IDS.typescript_mutable_field}`, () => state.mutable)) {
			rule_ids.push(RULE_IDS.typescript_mutable_field);
		}
		return rule_ids;
	}
}
