import type { NodeReadonlyStringSetCache } from "src/cache_types";
import { TypeScriptCallableAliasCollector } from "src/linting/test-support/type_script_callable_alias_collector";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import type {
	TypeScriptCallableAliasesContract,
	TypeScriptExpressionAliasesContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _callable alias collection_, _lexical alias lookup_. **/
export class TypeScriptCallableAliases implements TypeScriptCallableAliasesContract {
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly _scope_alias_cache: NodeReadonlyStringSetCache;

	/** Responsibilities: _scope alias cache_. **/
	private cached_scope_names(scope: ts.Node): ReadonlySet<string> {
		const cached = this._scope_alias_cache.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const collector = new TypeScriptCallableAliasCollector(scope, this._expression_aliases);
		collector.collect();
		const names = collector.names();
		this._scope_alias_cache.set(scope, names);
		return names;
	}

	/** Responsibilities: _scope ancestry collection_. **/
	private scope_nodes(node: ts.Node): ts.Node[] {
		const scopes: ts.Node[] = [];
		let current = node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				scopes.push(current);
			}
			current = current.parent;
		}
		scopes.push(current);
		return scopes;
	}

	/** Responsibilities: _field initialization_. **/
	public constructor() {
		this._expression_aliases = new TypeScriptExpressionAliases("", new TypeScriptObjectAliasDeclarationIndex());
		this._scope_alias_cache = new WeakMap();
	}

	/** Responsibilities: _callable alias names_. **/
	public names(node: ts.Node): ReadonlySet<string> {
		const scopes = this.scope_nodes(node);
		const first_scope = scopes[0];
		if (first_scope !== undefined && scopes.length === 1) {
			return this.cached_scope_names(first_scope);
		}
		const names = new Set<string>();
		for (const scope of scopes) {
			for (const name of this.cached_scope_names(scope)) {
				names.add(name);
			}
		}
		return names;
	}

	/** Responsibilities: _callable alias classification_. **/
	public contains(expression: ts.Expression, usage: ts.Node): boolean {
		const current = this._expression_aliases.unwrapped(expression);
		if (!ts.isIdentifier(current)) {
			return false;
		}
		return this.names(usage).has(current.text);
	}
}
