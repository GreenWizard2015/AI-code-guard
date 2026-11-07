import type { StringSetMap } from "src/analysis_types";
import type { NodeStringSetMapCache } from "src/cache_types";
import { TypeScriptMemberVariableAliases } from "src/parser/typescript-aliases/members/type_script_member_variable_aliases";
import type { TypeScriptMemberBindingContract } from "src/parser/typescript-aliases/protocols";
import type { MemberAliasAccessQuery, MemberAliasCopyQuery } from "src/parser/typescript-aliases/protocols";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import type { CallableStaticValueResolver } from "src/runtime_types";
import type {
	TypeScriptMemberAliasTarget,
	TypeScriptMemberVariableAliasesContract,
} from "src/typescript_analysis_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _member alias collection_, _static member name resolution_. **/
export class TypeScriptMemberBinding implements TypeScriptMemberBindingContract {
	private readonly _target_aliases: TypeScriptExpressionAliasesContract;
	private readonly _variable_aliases: TypeScriptMemberVariableAliasesContract;
	private readonly _static_value: CallableStaticValueResolver;
	private readonly _alias_cache: NodeStringSetMapCache;
	private readonly _declaration_index: TypeScriptObjectAliasDeclarationIndexContract;

	/** Responsibilities: _member expression unwrapping_. **/
	private unwrap(expression: ts.Expression): ts.Expression {
		let current = expression;
		while (ts.isAsExpression(current) || ts.isTypeAssertionExpression(current)) {
			current = current.expression;
		}
		while (ts.isParenthesizedExpression(current)) {
			current = current.expression;
		}
		return current;
	}

	/** Responsibilities: _member alias insertion_. **/
	private add(target: TypeScriptMemberAliasTarget, property: string): boolean {
		if (target.name === "" || property === "") {
			return false;
		}
		const existing = target.aliases.get(target.name);
		let properties: Set<string>;
		if (existing === undefined) {
			properties = new Set<string>();
		} else {
			properties = existing;
		}
		if (properties.has(property)) {
			return false;
		}
		properties.add(property);
		target.aliases.set(target.name, properties);
		return true;
	}

	/** Responsibilities: _copying aliased member names_. **/
	private copy_alias_properties(query: MemberAliasCopyQuery): boolean {
		const properties = query.target.aliases.get(query.source_name);
		if (properties === undefined) {
			return false;
		}
		let changed = false;
		for (const property of properties) {
			if (this.add(query.target, property)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _member access alias_. **/
	private append_access_value(query: MemberAliasAccessQuery): boolean {
		if (!ts.isPropertyAccessExpression(query.expression) && !ts.isElementAccessExpression(query.expression)) {
			return false;
		}
		if (!this._target_aliases.receiver({ expression: query.expression.expression, node: query.node })) {
			return false;
		}
		return this.add(query.target, this.member_name(query.expression, query.node));
	}

	/** Responsibilities: _member value aliases_. **/
	private value(target: TypeScriptMemberAliasTarget, initializer: ts.Expression, node: ts.Node): boolean {
		if (target.name === "") {
			return false;
		}
		const value = this.unwrap(initializer);
		if (ts.isIdentifier(value)) {
			return this.copy_alias_properties({ target, source_name: value.text });
		}
		return this.append_access_value({ target, expression: value, node });
	}

	/** Responsibilities: _member alias fixed point_. **/
	private collect_until_stable(aliases: StringSetMap, declarations: readonly ts.VariableDeclaration[]): void {
		let changed = true;
		while (changed) {
			changed = false;
			for (const declaration of declarations) {
				if (this._variable_aliases.append(aliases, declaration)) {
					changed = true;
				}
			}
		}
	}

	/** Responsibilities: _member binding initialization_. **/
	public constructor(
		target_name: string,
		static_value: CallableStaticValueResolver,
		declaration_index: TypeScriptObjectAliasDeclarationIndexContract,
	) {
		this._target_aliases = new TypeScriptExpressionAliases(target_name, declaration_index);
		this._static_value = static_value;
		this._alias_cache = new WeakMap<ts.Node, StringSetMap>();
		this._declaration_index = declaration_index;
		this._variable_aliases = new TypeScriptMemberVariableAliases(
			this._target_aliases,
			(aliases, name, property) => this.add({ aliases, name }, property),
			(request) => this.value({ aliases: request.aliases, name: request.name }, request.initializer, request.node),
			(expression) => this.unwrap(expression),
		);
	}

	/** Responsibilities: _member expression name_. **/
	public member_name(expression: ts.Expression, source: ts.Node): string {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text;
		}
		if (!ts.isElementAccessExpression(expression)) {
			return "";
		}
		const argument = expression.argumentExpression;
		if (argument === undefined) {
			return "";
		}
		if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
			return argument.text;
		}
		return this._static_value(argument, source);
	}

	/** Responsibilities: _member alias collection_. **/
	public collect(scope: ts.Node): StringSetMap {
		const cached = this._alias_cache.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const aliases = new Map<string, Set<string>>();
		const declarations = this._declaration_index.variable_scope(scope).member_variable_declarations();
		this.collect_until_stable(aliases, declarations);
		this._alias_cache.set(scope, aliases);
		return aliases;
	}
}
