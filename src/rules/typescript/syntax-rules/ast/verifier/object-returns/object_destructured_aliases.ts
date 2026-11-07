import type { NodeReadonlyStringSetCache } from "src/cache_types";
import type { ObjectDestructuredAliasesContract } from "src/contracts/protocols/lint_runtime_protocols";
import { DestructuredAliasScope } from "src/rules/typescript/syntax-rules/ast/verifier/object-returns/destructured_alias_scope";
import type { FakeObjectContract } from "src/shared_services_protocols";
import ts from "typescript";

/** Responsibilities: _scoped destructuring resolution_, _nested alias collection_. **/
export class ObjectDestructuredAliases implements ObjectDestructuredAliasesContract {
	private readonly _fake_object: FakeObjectContract;
	private readonly _scope_aliases: NodeReadonlyStringSetCache;

	/** Responsibilities: _destructured alias initialization_. **/
	public constructor(fake_object: FakeObjectContract) {
		this._fake_object = fake_object;
		this._scope_aliases = new WeakMap<ts.Node, ReadonlySet<string>>();
	}

	/** Responsibilities: _destructured alias names_. **/
	public names(scope_origin: ts.Node): ReadonlySet<string> {
		let scope = scope_origin;
		while (!ts.isSourceFile(scope) && !ts.isFunctionLike(scope)) {
			scope = scope.parent;
		}
		const cached = this._scope_aliases.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const collector = new DestructuredAliasScope(this._fake_object);
		collector.scan(scope);
		const aliases = collector.aliases();
		this._scope_aliases.set(scope, aliases);
		return aliases;
	}

	/** Responsibilities: _destructured alias classification_. **/
	public contains(identifier: ts.Expression, usage_site: ts.Node): boolean {
		if (!ts.isIdentifier(identifier)) {
			return false;
		}
		return this.names(usage_site).has(identifier.text);
	}
}
