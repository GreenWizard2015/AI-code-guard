import type { NodeReadonlyStringSetCache } from "src/cache_types";
import { TypeScriptExpressionAliasCollector } from "src/parser/typescript-aliases/expressions/type_script_expression_alias_collector";
import { TypeScriptExpressionTarget } from "src/parser/typescript-aliases/expressions/type_script_expression_target";
import type { TypeScriptExpressionAliasCollectorContract } from "src/parser/typescript-aliases/protocols";
import type {
	TypeScriptExpressionAliasesContract,
	TypeScriptExpressionQuery,
	TypeScriptExpressionReceiverQuery,
	TypeScriptObjectAliasDeclarationIndexContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _expression alias resolution_, _target identity matching_, _scope alias cache ownership_. **/
export class TypeScriptExpressionAliases implements TypeScriptExpressionAliasesContract {
	private readonly _target: TypeScriptExpressionTarget;
	private readonly _collector: TypeScriptExpressionAliasCollectorContract;
	private readonly _scope_aliases: NodeReadonlyStringSetCache;
	private readonly _declaration_index: TypeScriptObjectAliasDeclarationIndexContract;
	private readonly _member_names: WeakMap<ts.Expression, string>;

	/** Responsibilities: _cached aliases by scope_. **/
	private cached_aliases(scope: ts.Node): ReadonlySet<string> {
		const cached = this._scope_aliases.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const aliases = this._collector.collect(scope);
		this._scope_aliases.set(scope, aliases);
		return aliases;
	}

	/** Responsibilities: _expression alias resolver initialization_. **/
	public constructor(target_name: string, declaration_index: TypeScriptObjectAliasDeclarationIndexContract) {
		this._scope_aliases = new WeakMap<ts.Node, ReadonlySet<string>>();
		this._declaration_index = declaration_index;
		this._member_names = new WeakMap<ts.Expression, string>();
		this._target = new TypeScriptExpressionTarget(target_name, declaration_index);
		this._collector = new TypeScriptExpressionAliasCollector(this, declaration_index);
	}

	/** Responsibilities: _expression member name access_. **/
	public member_name(query: TypeScriptExpressionQuery): string {
		const cached = this._member_names.get(query.expression);
		if (cached !== undefined) {
			return cached;
		}
		let name = "";
		if (ts.isPropertyAccessExpression(query.expression)) {
			name = query.expression.name.text;
		} else if (ts.isElementAccessExpression(query.expression) && query.expression.argumentExpression !== undefined) {
			const key = this.unwrapped(query.expression.argumentExpression);
			if (ts.isStringLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key)) {
				name = key.text;
			}
		}
		this._member_names.set(query.expression, name);
		return name;
	}

	/** Responsibilities: _transparent expression resolution_. **/
	public unwrapped(expression: ts.Expression): ts.Expression {
		return this._declaration_index.normalize_expression(expression, this._target);
	}

	/** Responsibilities: _expression alias chain extension_. **/
	public append_alias(aliases: Set<string>, name: string, initializer: ts.Expression): boolean {
		const value = this.unwrapped(initializer);
		if (this._target.matches(value)) {
			if (aliases.has(name)) {
				return false;
			}
			aliases.add(name);
			return true;
		}
		if (!ts.isIdentifier(value)) {
			return false;
		}
		if (!aliases.has(value.text) || aliases.has(name)) {
			return false;
		}
		aliases.add(name);
		return true;
	}

	/** Responsibilities: _expression alias names resolution_. **/
	public names(node: ts.Node): ReadonlySet<string> {
		const names = new Set<string>();
		let current = node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				for (const name of this.cached_aliases(current)) {
					names.add(name);
				}
			}
			current = current.parent;
		}
		for (const name of this.cached_aliases(current)) {
			names.add(name);
		}
		return names;
	}

	/** Responsibilities: _expression receiver classification_. **/
	public receiver(query: TypeScriptExpressionReceiverQuery): boolean {
		const current = this.unwrapped(query.expression);
		if (this._target.matches(current)) {
			return true;
		}
		if (!ts.isIdentifier(current)) {
			return false;
		}
		let scope = query.node;
		while (!ts.isSourceFile(scope)) {
			if (ts.isFunctionLike(scope) && this.cached_aliases(scope).has(current.text)) {
				return true;
			}
			scope = scope.parent;
		}
		return this.cached_aliases(scope).has(current.text);
	}
}
