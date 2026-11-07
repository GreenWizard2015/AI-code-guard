import {
	TYPESCRIPT_OBJECT_OWN_PROPERTY_METHOD,
	TYPESCRIPT_OBJECT_STRING_METHOD,
	TYPESCRIPT_PROTOTYPE_NAME,
} from "src/constants";
import { ObjectIntrinsicMemberModel } from "src/linting/object_intrinsic_member_model";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptMemberAliases } from "src/parser/typescript-aliases/type_script_member_aliases";
import type { ObjectValueRulesContract } from "src/runtime_protocols";
import type { StaticExpressionValuesContract } from "src/shared_services_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptMemberAliasesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _Object intrinsic member model_, _Object string operation model_. **/
export class ObjectIntrinsicModel implements ObjectValueRulesContract {
	private readonly _object_aliases: TypeScriptExpressionAliasesContract;
	private readonly _static_expression_values: StaticExpressionValuesContract;
	private readonly _object_member_aliases: TypeScriptMemberAliasesContract;
	private readonly _member_model: ObjectIntrinsicMemberModel;
	private readonly _object_method_name: string;
	private readonly _string_conversion_name: string;
	private readonly _prototype_member_aliases: TypeScriptMemberAliasesContract;

	/** Responsibilities: _forwarded Object.assign identity_. **/
	private forwarded_object_assign(forwarded_member: ts.Expression, forwarded_source_call: ts.CallExpression): boolean {
		if (!ts.isPropertyAccessExpression(forwarded_member)) {
			return false;
		}
		if (forwarded_member.name.text !== "call" && forwarded_member.name.text !== "apply") {
			return false;
		}
		if (!ts.isIdentifier(forwarded_member.expression)) {
			return false;
		}
		return this._object_member_aliases.property({
			expression: forwarded_member.expression,
			node: forwarded_source_call,
			name: "assign",
		});
	}

	/** Responsibilities: _Object intrinsic model initialization_. **/
	public constructor(
		static_expression_values: StaticExpressionValuesContract,
		declaration_index: TypeScriptObjectAliasDeclarationIndexContract,
	) {
		this._static_expression_values = static_expression_values;
		this._object_method_name = TYPESCRIPT_OBJECT_OWN_PROPERTY_METHOD;
		this._string_conversion_name = TYPESCRIPT_OBJECT_STRING_METHOD;
		this._object_aliases = new TypeScriptExpressionAliases("Object", declaration_index);
		this._object_member_aliases = new TypeScriptMemberAliases(
			"Object",
			(expression, node) => this._static_expression_values.value(expression, node),
			declaration_index,
		);
		const prototype_path = `Object.${TYPESCRIPT_PROTOTYPE_NAME}`;
		this._prototype_member_aliases = new TypeScriptMemberAliases(
			prototype_path,
			(expression, node) => this._static_expression_values.value(expression, node),
			declaration_index,
		);
		this._member_model = new ObjectIntrinsicMemberModel(
			this._object_aliases,
			this._static_expression_values,
			declaration_index,
		);
	}

	/** Responsibilities: _Object string operation classification_. **/
	public object_string(string_candidate: ts.Node): boolean {
		if (!ts.isCallExpression(string_candidate)) {
			return false;
		}
		const access = string_candidate.expression;
		if (!ts.isPropertyAccessExpression(access) && !ts.isElementAccessExpression(access)) {
			return false;
		}
		const expression = this._object_aliases.unwrapped(access.expression);
		if (ts.isIdentifier(expression)) {
			return this._prototype_member_aliases.property({
				expression,
				node: string_candidate,
				name: this._string_conversion_name,
			});
		}
		return this._member_model.prototype_string_member(expression, string_candidate, this._string_conversion_name);
	}

	/** Responsibilities: _Object.assign operation classification_. **/
	public object_assign(assign_candidate: ts.Node): boolean {
		if (!ts.isCallExpression(assign_candidate)) {
			return false;
		}
		const expression = this._object_aliases.unwrapped(assign_candidate.expression);
		if (this.forwarded_object_assign(expression, assign_candidate)) {
			return true;
		}
		if (ts.isIdentifier(expression)) {
			return this._object_member_aliases.property({ expression, node: assign_candidate, name: "assign" });
		}
		return this._member_model.object_member(expression, assign_candidate, "assign");
	}

	/** Responsibilities: _Object method operation classification_. **/
	public object_method(method_candidate: ts.Node): boolean {
		if (!ts.isCallExpression(method_candidate)) {
			return false;
		}
		const expression = this._object_aliases.unwrapped(method_candidate.expression);
		if (ts.isIdentifier(expression)) {
			return this._object_member_aliases.property({
				expression,
				node: method_candidate,
				name: this._object_method_name,
			});
		}
		if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
			return false;
		}
		if (this._member_model.member_name(expression, method_candidate) !== "call") {
			return false;
		}
		return this._member_model.object_chain(expression.expression, method_candidate);
	}

	/** Responsibilities: _Object own-property operation classification_. **/
	public object_has_own(candidate: ts.Node): boolean {
		if (!ts.isCallExpression(candidate)) {
			return false;
		}
		return this._member_model.object_member(candidate.expression, candidate, "hasOwn");
	}
}
