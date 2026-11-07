import type { NodeReadonlyStringSetCache } from "src/cache_types";
import { TypeScriptObjectCallableScopeAnalysis } from "src/linting/test-support/type_script_object_callable_scope_analysis";
import { TypeScriptCallableTypeProperties } from "src/parser/typescript-aliases/callables/type_script_callable_type_properties";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import type {
	TypeScriptCallableTypePropertiesContract,
	TypeScriptExpressionAliasesContract,
	TypeScriptObjectCallableAliasesContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _object callable alias collection_, _scoped callable lookup_. **/
export class TypeScriptObjectCallableAliases implements TypeScriptObjectCallableAliasesContract {
	private readonly _property_names: TypeScriptCallableTypePropertiesContract;
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly _scope_alias_cache: NodeReadonlyStringSetCache;

	/** Responsibilities: _scope analysis_. **/
	private collect(scope: ts.Node): ReadonlySet<string> {
		const analysis = new TypeScriptObjectCallableScopeAnalysis({
			root: scope,
			property_names: this._property_names,
			expression_aliases: this._expression_aliases,
		});
		let changed = analysis.append();
		while (changed) {
			changed = analysis.append();
		}
		return analysis.names();
	}

	/** Responsibilities: _typed object scope traversal_. **/
	private scopes(scope_node: ts.Node): ts.Node[] {
		const scopes: ts.Node[] = [];
		let current = scope_node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				scopes.push(current);
			}
			current = current.parent;
		}
		scopes.push(current);
		return scopes;
	}

	/** Responsibilities: _typed object alias cache_. **/
	private cached_scope_names(scope: ts.Node): ReadonlySet<string> {
		const cached = this._scope_alias_cache.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const names = this.collect(scope);
		this._scope_alias_cache.set(scope, names);
		return names;
	}

	/** Responsibilities: _typed callable alias membership_. **/
	private contains_name(name: string, scopes: readonly ts.Node[]): boolean {
		for (const scope of scopes) {
			if (this.cached_scope_names(scope).has(name)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _typed object composition_. **/
	public constructor() {
		this._property_names = new TypeScriptCallableTypeProperties();
		this._expression_aliases = new TypeScriptExpressionAliases("", new TypeScriptObjectAliasDeclarationIndex());
		this._scope_alias_cache = new WeakMap();
	}

	/** Responsibilities: _typed object alias collection_. **/
	public names(node: ts.Node): ReadonlySet<string> {
		const scopes = this.scopes(node);
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

	/** Responsibilities: _typed object alias classification_. **/
	public contains(expression: ts.Expression, node: ts.Node): boolean {
		const current = this._expression_aliases.unwrapped(expression);
		if (!ts.isIdentifier(current)) {
			return false;
		}
		return this.contains_name(current.text, this.scopes(node));
	}
}
