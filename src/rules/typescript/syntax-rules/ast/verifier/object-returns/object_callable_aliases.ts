import type { NodeReadonlyStringSetCache } from "src/cache_types";
import { ObjectCallableBinding } from "src/rules/typescript/syntax-rules/ast/verifier/object-returns/object_callable_binding";
import type { FakeObjectContract } from "src/shared_services_protocols";
import type { ObjectCallableAliasesContract } from "src/shared_services_protocols";
import ts from "typescript";

/** Responsibilities: _callable object alias resolution_, _alias usage matching_. **/
export class ObjectCallableAliases implements ObjectCallableAliasesContract {
	private readonly _fake_object: FakeObjectContract;
	private readonly _scope_aliases: NodeReadonlyStringSetCache;

	/** Responsibilities: _callable alias initialization_. **/
	public constructor(fake_object: FakeObjectContract) {
		this._fake_object = fake_object;
		this._scope_aliases = new WeakMap<ts.Node, ReadonlySet<string>>();
	}

	/** Responsibilities: _callable alias names_. **/
	public names(scope_origin: ts.Node): ReadonlySet<string> {
		let scope = scope_origin;
		while (!ts.isSourceFile(scope) && !ts.isFunctionLike(scope)) {
			scope = scope.parent;
		}
		const cached = this._scope_aliases.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const binding = new ObjectCallableBinding(this._fake_object, scope);
		const aliases = binding.collect();
		this._scope_aliases.set(scope, aliases);
		return aliases;
	}

	/** Responsibilities: _callable alias classification_. **/
	public contains(identifier: ts.Expression, usage_site: ts.Node): boolean {
		if (!ts.isIdentifier(identifier)) {
			return false;
		}
		return this.names(usage_site).has(identifier.text);
	}
}
