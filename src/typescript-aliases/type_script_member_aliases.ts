import ts from "typescript";
import { TypeScriptMemberBinding } from "src/typescript-aliases/type_script_member_binding";
import type { NodeStringSetMapCache } from "src/cache_types";
import type { StringSetMap } from "src/analysis_types";
import type { StaticValueResolver } from "src/runtime_types";
import type { TypeScriptMemberAliasesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptMemberBindingContract } from "src/typescript_analysis_protocols";

/** Responsibilities: _member alias matching_, _property alias resolution_. **/
export class TypeScriptMemberAliases implements TypeScriptMemberAliasesContract {
	private readonly bindings: TypeScriptMemberBindingContract;
	private readonly property_cache: NodeStringSetMapCache;

	/** Responsibilities: _member alias names resolution_. **/
	private properties(node: ts.Node): StringSetMap {
		const cached = this.property_cache.get(node);
		if (cached !== undefined) {
			return cached;
		}
		const aliases = new Map<string, Set<string>>();
		let current = node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				this.merge(aliases, this.bindings.collect(current));
			}
			current = current.parent;
		}
		this.merge(aliases, this.bindings.collect(current));
		this.property_cache.set(node, aliases);
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
	public constructor(target_name: string, static_value: StaticValueResolver) {
		this.property_cache = new WeakMap<ts.Node, StringSetMap>();
		this.bindings = new TypeScriptMemberBinding(target_name, static_value);
	}

	/** Responsibilities: _member alias classification_. **/
	public member(expression: ts.Expression, node: ts.Node): boolean {
		if (!ts.isIdentifier(expression)) {
			return false;
		}
		return this.properties(node).has(expression.text);
	}

	/** Responsibilities: _named member alias classification_. **/
	public property(expression: ts.Expression, node: ts.Node, name: string): boolean {
		if (!ts.isIdentifier(expression)) {
			return false;
		}
		const properties = this.properties(node).get(expression.text);
		if (properties === undefined) {
			return false;
		}
		return properties.has(name);
	}
}
