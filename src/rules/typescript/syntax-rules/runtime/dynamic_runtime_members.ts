import { ObjectIntrinsicModel } from "src/linting/object_intrinsic_model";
import { TypeScriptStaticArrayKeys } from "src/parser/typescript-aliases/callables/static-array/type_script_static_array_keys";
import { DynamicObjectMemberAliases } from "src/parser/typescript-aliases/members/dynamic_object_member_aliases";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptMemberAliases } from "src/parser/typescript-aliases/type_script_member_aliases";
import { TypeScriptStaticExpressionOperations } from "src/parser/typescript-aliases/type_script_static_expression_operations";
import { TypeScriptStaticExpressionValues } from "src/parser/typescript-aliases/type_script_static_expression_values";
import { DynamicRuntimeMemberExpressions } from "src/rules/typescript/syntax-rules/runtime/dynamic_runtime_member_expressions";
import type {
	DynamicObjectMemberAliasesContract,
	DynamicRuntimeMembersContract,
	ObjectValueRulesContract,
} from "src/runtime_protocols";
import type { StaticExpressionValuesContract } from "src/shared_services_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptMemberAliasesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _dynamic object access detection_, _runtime member alias resolution_. **/
export class DynamicRuntimeMembers implements DynamicRuntimeMembersContract {
	private readonly _dynamic_member_owners: Set<string>;
	private readonly _dynamic_call_names: Set<string>;
	private readonly _object_value_rules: ObjectValueRulesContract;
	private readonly _reflect_aliases: TypeScriptExpressionAliasesContract;
	private readonly _proxy_aliases: TypeScriptExpressionAliasesContract;
	private readonly _static_expression_values: StaticExpressionValuesContract;
	private readonly _dynamic_object_aliases: DynamicObjectMemberAliasesContract;
	private readonly _proxy_object_aliases: DynamicObjectMemberAliasesContract;
	private readonly _member_expressions: DynamicRuntimeMemberExpressions;
	private readonly _reflect_member_aliases: TypeScriptMemberAliasesContract;
	private readonly _proxy_member_aliases: TypeScriptMemberAliasesContract;
	private readonly _object_member_aliases: TypeScriptMemberAliasesContract;

	/** Responsibilities: _direct dynamic member identification_. **/
	private direct_member(receiver_expression: ts.Expression, lookup_site: ts.Node): boolean {
		if (this._dynamic_object_aliases.receiver({ expression: receiver_expression, source: lookup_site })) {
			return true;
		}
		if (this._proxy_object_aliases.receiver({ expression: receiver_expression, source: lookup_site })) {
			return true;
		}
		if (this._reflect_aliases.receiver({ expression: receiver_expression, node: lookup_site })) {
			return true;
		}
		return this._proxy_aliases.receiver({ expression: receiver_expression, node: lookup_site });
	}

	/** Responsibilities: _dynamic member ownership_. **/
	private owner_member(owner_expression: ts.Expression, alias_lookup: ts.Node): boolean {
		if (this._dynamic_member_owners.has(this._member_expressions.member_name(owner_expression))) {
			return true;
		}
		if (this._dynamic_object_aliases.receiver({ expression: owner_expression, source: alias_lookup })) {
			return true;
		}
		if (this._proxy_object_aliases.receiver({ expression: owner_expression, source: alias_lookup })) {
			return true;
		}
		if (this._reflect_aliases.receiver({ expression: owner_expression, node: alias_lookup })) {
			return true;
		}
		return this._proxy_aliases.receiver({ expression: owner_expression, node: alias_lookup });
	}

	/** Responsibilities: _dynamic member identification_. **/
	private dynamic_member(member_expression: ts.Expression, analysis_node: ts.Node): boolean {
		if (this.direct_member(member_expression, analysis_node)) {
			return true;
		}
		for (const owner_expression of this._member_expressions.member_owners(member_expression)) {
			if (this.owner_member(owner_expression, analysis_node)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _dynamic member alias classification_. **/
	private member_alias(member_expression: ts.Expression, alias_site: ts.Node): boolean {
		if (this._reflect_member_aliases.member({ expression: member_expression, node: alias_site })) {
			return true;
		}
		if (this._proxy_member_aliases.member({ expression: member_expression, node: alias_site })) {
			return true;
		}
		return this._object_member_aliases.member({ expression: member_expression, node: alias_site });
	}

	/** Responsibilities: _dynamic invocation identification_. **/
	private dynamic_invocation(call_target: ts.Expression, invocation: ts.Node): boolean {
		if (ts.isIdentifier(call_target)) {
			if (this._dynamic_call_names.has(call_target.text)) {
				return true;
			}
			if (this._proxy_aliases.receiver({ expression: call_target, node: invocation })) {
				return true;
			}
			return this.member_alias(call_target, invocation);
		}
		return this.dynamic_member(call_target, invocation);
	}

	/** Responsibilities: _dynamic access identification_. **/
	private dynamic_access(access_candidate: ts.Node): boolean {
		if (!ts.isPropertyAccessExpression(access_candidate) && !ts.isElementAccessExpression(access_candidate)) {
			return false;
		}
		return this.dynamic_member(access_candidate, access_candidate);
	}

	/** Responsibilities: _dynamic property identification_. **/
	private dynamic_property(property_candidate: ts.Node): boolean {
		if (!ts.isPropertyAccessExpression(property_candidate)) {
			if (!ts.isElementAccessExpression(property_candidate)) {
				return false;
			}
		}
		if (this.property_parent_blocked(property_candidate)) {
			return false;
		}
		return this.dynamic_access(property_candidate);
	}

	/** Responsibilities: _nested property access exclusion_. **/
	private property_parent_blocked(property_access: ts.Node): boolean {
		if (ts.isCallExpression(property_access.parent)) {
			return true;
		}
		if (ts.isNewExpression(property_access.parent)) {
			return true;
		}
		if (ts.isPropertyAccessExpression(property_access.parent)) {
			return true;
		}
		return ts.isElementAccessExpression(property_access.parent);
	}

	/** Responsibilities: _dynamic runtime member composition_. **/
	public constructor(declaration_index: TypeScriptObjectAliasDeclarationIndexContract) {
		this._dynamic_member_owners = new Set(["Reflect", "Proxy"]);
		this._dynamic_call_names = new Set(["Proxy"]);
		this._static_expression_values = new TypeScriptStaticExpressionValues(new TypeScriptStaticExpressionOperations());
		this._object_value_rules = new ObjectIntrinsicModel(this._static_expression_values, declaration_index);
		this._reflect_aliases = new TypeScriptExpressionAliases("Reflect", declaration_index);
		this._proxy_aliases = new TypeScriptExpressionAliases("Proxy", declaration_index);
		this._member_expressions = new DynamicRuntimeMemberExpressions();
		this._reflect_member_aliases = new TypeScriptMemberAliases(
			"Reflect",
			(expression, node) => this._static_expression_values.value(expression, node),
			declaration_index,
		);
		this._proxy_member_aliases = new TypeScriptMemberAliases(
			"Proxy",
			(expression, node) => this._static_expression_values.value(expression, node),
			declaration_index,
		);
		this._object_member_aliases = new TypeScriptMemberAliases(
			"Object",
			(expression, node) => this._static_expression_values.value(expression, node),
			declaration_index,
		);
		const static_array_keys = new TypeScriptStaticArrayKeys(declaration_index);
		this._dynamic_object_aliases = new DynamicObjectMemberAliases("Reflect", static_array_keys, declaration_index);
		this._proxy_object_aliases = new DynamicObjectMemberAliases("Proxy", static_array_keys, declaration_index);
	}

	/** Responsibilities: _dynamic runtime member usage_. **/
	public matches(candidate_node: ts.Node): boolean {
		if (ts.isCallExpression(candidate_node)) {
			if (this._object_value_rules.object_has_own(candidate_node)) {
				return true;
			}
			if (this._object_value_rules.object_method(candidate_node)) {
				return true;
			}
			return this.call(candidate_node);
		}
		if (ts.isNewExpression(candidate_node)) {
			return this.construct(candidate_node);
		}
		return this.dynamic_property(candidate_node);
	}

	/** Responsibilities: _dynamic member rule_. **/
	public call(invocation: ts.CallExpression): boolean {
		return this.dynamic_invocation(invocation.expression, invocation);
	}

	/** Responsibilities: _dynamic construction usage_. **/
	public construct(construction: ts.NewExpression): boolean {
		return this.dynamic_invocation(construction.expression, construction);
	}
}
