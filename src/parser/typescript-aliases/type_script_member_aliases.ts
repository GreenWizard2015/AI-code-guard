import type { StringSetMap } from "src/analysis_types";
import type { NodeStringSetMapCache } from "src/cache_types";
import { TypeScriptMemberBinding } from "src/parser/typescript-aliases/members/type_script_member_binding";
import type {
	TypeScriptMemberBindingContract,
	TypeScriptStaticExpressionNodeQuery,
} from "src/parser/typescript-aliases/protocols";
import type { CallableStaticValueResolver } from "src/runtime_types";
import type {
	TypeScriptExpressionReceiverQuery,
	TypeScriptMemberAliasesContract,
	TypeScriptNamedMemberAliasQuery,
	TypeScriptObjectAliasDeclarationIndexContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _member alias matching_, _property alias resolution_. **/
export class TypeScriptMemberAliases implements TypeScriptMemberAliasesContract {
	private readonly _bindings: TypeScriptMemberBindingContract;
	private readonly _property_cache: NodeStringSetMapCache;

	/** Responsibilities: _member alias scope collection_. **/
	private scope_nodes(query: TypeScriptStaticExpressionNodeQuery): ts.Node[] {
		const scopes: ts.Node[] = [];
		let current = query.node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				scopes.push(current);
			}
			current = current.parent;
		}
		scopes.push(current);
		return scopes;
	}

	/** Responsibilities: _member cache owner_. **/
	private cache_owner(node: ts.Node): ts.Node {
		let current = node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				return current;
			}
			current = current.parent;
		}
		return current;
	}

	/** Responsibilities: _member alias names resolution_. **/
	private properties(query: TypeScriptExpressionReceiverQuery): StringSetMap {
		const cache_owner = this.cache_owner(query.node);
		const cached = this._property_cache.get(cache_owner);
		if (cached !== undefined) {
			return cached;
		}
		const scopes = this.scope_nodes({ node: query.node });
		const aliases = new Map<string, Set<string>>();
		for (const scope of scopes) {
			this.merge(aliases, this._bindings.collect(scope));
		}
		this._property_cache.set(cache_owner, aliases);
		return aliases;
	}

	/** Responsibilities: _alias map merging_. **/
	private merge(target: StringSetMap, source: StringSetMap): void {
		for (const [name, properties] of source) {
			const existing = target.get(name);
			let known: Set<string>;
			if (existing === undefined) {
				known = new Set<string>();
			} else {
				known = existing;
			}
			for (const property of properties) {
				known.add(property);
			}
			target.set(name, known);
		}
	}

	/** Responsibilities: _member alias resolver initialization_. **/
	public constructor(
		target_name: string,
		static_value: CallableStaticValueResolver,
		declaration_index: TypeScriptObjectAliasDeclarationIndexContract,
	) {
		this._property_cache = new WeakMap<ts.Node, StringSetMap>();
		this._bindings = new TypeScriptMemberBinding(target_name, static_value, declaration_index);
	}

	/** Responsibilities: _member alias classification_. **/
	public member(query: TypeScriptExpressionReceiverQuery): boolean {
		if (!ts.isIdentifier(query.expression)) {
			return false;
		}
		return this.properties(query).has(query.expression.text);
	}

	/** Responsibilities: _named member alias classification_. **/
	public property(query: TypeScriptNamedMemberAliasQuery): boolean {
		if (!ts.isIdentifier(query.expression)) {
			return false;
		}
		const properties = this.properties(query).get(query.expression.text);
		if (properties === undefined) {
			return false;
		}
		return properties.has(query.name);
	}
}
