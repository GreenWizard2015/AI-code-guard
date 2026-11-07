import { TYPESCRIPT_PROTOTYPE_NAME } from "src/constants";
import { TypeScriptStaticArrayKeys } from "src/parser/typescript-aliases/callables/static-array/type_script_static_array_keys";
import { DynamicObjectMemberAliases } from "src/parser/typescript-aliases/members/dynamic_object_member_aliases";
import type { DynamicObjectMemberAliasesContract } from "src/runtime_protocols";
import type { StaticExpressionValuesContract } from "src/shared_services_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _Object prototype member identity_, _prototype string operation identity_. **/
export class ObjectIntrinsicMemberModel {
	private readonly _object_aliases: TypeScriptExpressionAliasesContract;
	private readonly _nested_object_aliases: DynamicObjectMemberAliasesContract;
	private readonly _static_expression_values: StaticExpressionValuesContract;
	private readonly _prototype_object_aliases: DynamicObjectMemberAliasesContract;
	private readonly _prototype_name: string;

	/** Responsibilities: _Object receiver identity_. **/
	private object_receiver(receiver_expression: ts.Expression, receiver_source: ts.Node): boolean {
		if (this._object_aliases.receiver({ expression: receiver_expression, node: receiver_source })) {
			return true;
		}
		return this._nested_object_aliases.receiver({ expression: receiver_expression, source: receiver_source });
	}

	/** Responsibilities: _Object element key identity_. **/
	private element_key_name(key_expression: ts.Expression, key_source: ts.Node): string {
		const key = this._object_aliases.unwrapped(key_expression);
		if (ts.isStringLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key)) {
			return key.text;
		}
		return this._static_expression_values.value(key_expression, key_source);
	}

	/** Responsibilities: _Object prototype receiver identity_. **/
	private object_prototype(prototype_expression: ts.Expression): boolean {
		const expression = this._object_aliases.unwrapped(prototype_expression);
		if (this.member_name(expression, expression) !== this._prototype_name) {
			return false;
		}
		if (ts.isPropertyAccessExpression(expression)) {
			return this.object_receiver(expression.expression, expression);
		}
		if (ts.isElementAccessExpression(expression)) {
			return this.object_receiver(expression.expression, expression);
		}
		return false;
	}

	/** Responsibilities: _Object access chain identity_. **/
	private object_access_chain(chain_expression: ts.AccessExpression, alias_source: ts.Node): boolean {
		if (this.member_name(chain_expression, alias_source) === "") {
			return false;
		}
		return this.object_chain(chain_expression.expression, alias_source);
	}

	/** Responsibilities: _Object prototype model initialization_. **/
	public constructor(
		object_aliases: TypeScriptExpressionAliasesContract,
		static_expression_values: StaticExpressionValuesContract,
		declaration_index: TypeScriptObjectAliasDeclarationIndexContract,
	) {
		this._object_aliases = object_aliases;
		this._static_expression_values = static_expression_values;
		const static_array_keys = new TypeScriptStaticArrayKeys(declaration_index);
		this._nested_object_aliases = new DynamicObjectMemberAliases("Object", static_array_keys, declaration_index);
		this._prototype_name = TYPESCRIPT_PROTOTYPE_NAME;
		const prototype_path = `Object.${this._prototype_name}`;
		this._prototype_object_aliases = new DynamicObjectMemberAliases(
			prototype_path,
			static_array_keys,
			declaration_index,
		);
	}

	/** Responsibilities: _prototype string-conversion member identity_. **/
	public prototype_string_member(
		member_expression: ts.Expression,
		conversion_source_call: ts.CallExpression,
		string_conversion_name: string,
	): boolean {
		if (
			this._prototype_object_aliases.member({
				expression: member_expression,
				source: conversion_source_call,
				member_name: string_conversion_name,
			})
		) {
			return true;
		}
		if (this.member_name(member_expression, conversion_source_call) !== string_conversion_name) {
			return false;
		}
		if (ts.isPropertyAccessExpression(member_expression)) {
			return this.object_prototype(member_expression.expression);
		}
		if (ts.isElementAccessExpression(member_expression)) {
			return this.object_prototype(member_expression.expression);
		}
		return false;
	}

	/** Responsibilities: _Object member name identity_. **/
	public member_name(member_access: ts.Expression, lookup_source: ts.Node): string {
		if (ts.isPropertyAccessExpression(member_access)) {
			return member_access.name.text;
		}
		if (!ts.isElementAccessExpression(member_access) || member_access.argumentExpression === undefined) {
			return "";
		}
		return this.element_key_name(member_access.argumentExpression, lookup_source);
	}

	/** Responsibilities: _Object member chain identity_. **/
	public object_chain(chain_expression: ts.Expression, alias_source: ts.Node): boolean {
		const expression = this._object_aliases.unwrapped(chain_expression);
		if (ts.isIdentifier(expression)) {
			return this._object_aliases.receiver({ expression, node: alias_source });
		}
		if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
			return false;
		}
		return this.object_access_chain(expression, alias_source);
	}

	/** Responsibilities: _Object intrinsic member identity_. **/
	public object_member(member: ts.Expression, source: ts.Node, member_name: string): boolean {
		if (this._nested_object_aliases.member({ expression: member, source, member_name })) {
			return true;
		}
		if (!ts.isPropertyAccessExpression(member) && !ts.isElementAccessExpression(member)) {
			return false;
		}
		if (this.member_name(member, source) !== member_name) {
			return false;
		}
		return this.object_receiver(member.expression, source);
	}
}
