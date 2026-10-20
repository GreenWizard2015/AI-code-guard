import ts from "typescript";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";
import { TypeScriptMemberVariableAliases } from "src/typescript-aliases/type_script_member_variable_aliases";
import type { NodeStringSetMapCache } from "src/cache_types";
import type { StringSetMap } from "src/analysis_types";
import type { StaticValueResolver } from "src/runtime_types";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptMemberBindingContract, TypeScriptMemberVariableAliasesContract } from "src/typescript_analysis_protocols";

/** Responsibilities: _member alias collection_, _static member name resolution_. **/
export class TypeScriptMemberBinding implements TypeScriptMemberBindingContract {
	private readonly target_aliases: TypeScriptExpressionAliasesContract;
	private readonly variable_aliases: TypeScriptMemberVariableAliasesContract;
	private readonly static_value: StaticValueResolver;
	private readonly alias_cache: NodeStringSetMapCache;
	private readonly declaration_cache: WeakMap<ts.Node, readonly ts.VariableDeclaration[]>;

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
	private add(aliases: StringSetMap, name: string, property: string): boolean {
		if (name === "" || property === "") {
			return false;
		}
		const existing = aliases.get(name);
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
		aliases.set(name, properties);
		return true;
	}

	/** Responsibilities: _known member aliases_. **/
	private known(aliases: StringSetMap, name: string, value: ts.Identifier): boolean {
		const properties = aliases.get(value.text);
		if (properties === undefined) {
			return false;
		}
		let changed = false;
		for (const property of properties) {
			if (this.add(aliases, name, property)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _source member aliases_. **/
	private source(aliases: StringSetMap, name: string, value: ts.Expression, node: ts.Node): boolean {
		if (!ts.isPropertyAccessExpression(value) && !ts.isElementAccessExpression(value)) {
			return false;
		}
		if (!this.target_aliases.receiver(value.expression, node)) {
			return false;
		}
		return this.add(aliases, name, this.member_name(value, node));
	}

	/** Responsibilities: _member value aliases_. **/
	private value(aliases: StringSetMap, name: string, initializer: ts.Expression, node: ts.Node): boolean {
		if (name === "") {
			return false;
		}
		const value = this.unwrap(initializer);
		if (ts.isIdentifier(value)) {
			return this.known(aliases, name, value);
		}
		return this.source(aliases, name, value, node);
	}

	/** Responsibilities: _scope variable declaration collection_. **/
	private append_declarations(node: ts.Node, root: ts.Node, declarations: ts.VariableDeclaration[]): void {
		if (node !== root) {
			if (ts.isFunctionLike(node)) {
				return;
			}
		}
		if (ts.isVariableDeclaration(node)) {
			declarations.push(node);
		}
		node.forEachChild((child) => this.append_declarations(child, root, declarations));
	}

	/** Responsibilities: _member declaration index resolution_. **/
	private declarations_for(scope: ts.Node): readonly ts.VariableDeclaration[] {
		const cached = this.declaration_cache.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const declarations: ts.VariableDeclaration[] = [];
		this.append_declarations(scope, scope, declarations);
		this.declaration_cache.set(scope, declarations);
		return declarations;
	}

	/** Responsibilities: _member alias fixed-point collection_. **/
	private collect_uncached(scope: ts.Node): StringSetMap {
		const aliases = new Map<string, Set<string>>();
		const declarations = this.declarations_for(scope);
		let changed = true;
		while (changed) {
			changed = false;
			for (const declaration of declarations) {
				if (this.variable_aliases.append(aliases, declaration)) {
					changed = true;
				}
			}
		}
		return aliases;
	}

	/** Responsibilities: _member binding initialization_. **/
	public constructor(target_name: string, static_value: StaticValueResolver) {
		this.target_aliases = new TypeScriptExpressionAliases(target_name);
		this.static_value = static_value;
		this.alias_cache = new WeakMap<ts.Node, StringSetMap>();
		this.declaration_cache = new WeakMap<ts.Node, readonly ts.VariableDeclaration[]>();
		this.variable_aliases = new TypeScriptMemberVariableAliases(
			this.target_aliases,
			(aliases, name, property) => this.add(aliases, name, property),
			(request) => this.value(request.aliases, request.name, request.initializer, request.node),
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
		return this.static_value(argument, source);
	}

	/** Responsibilities: _member alias collection_. **/
	public collect(scope: ts.Node): StringSetMap {
		const cached = this.alias_cache.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const aliases = this.collect_uncached(scope);
		this.alias_cache.set(scope, aliases);
		return aliases;
	}
}
