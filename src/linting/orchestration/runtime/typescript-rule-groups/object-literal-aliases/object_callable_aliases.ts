import ts from "typescript";
import type { FakeObjectContract, ObjectCallableBindingContract } from "src/protocols";
import type { ObjectCallableAliasesContract } from "src/protocols";
import type { ObjectScopeAliasCache } from "src/linting/orchestration/runtime/typescript-rule-groups/object-literal-aliases/types";
import { ObjectCallableBinding } from "src/linting/orchestration/runtime/typescript-rule-groups/object-literal-aliases/object_callable_binding";

/** Responsibilities: _callable object alias resolution_, _alias usage matching_. **/
export class ObjectCallableAliases implements ObjectCallableAliasesContract {
	private readonly binding: ObjectCallableBindingContract;
	private readonly scope_aliases: ObjectScopeAliasCache;

	/** Responsibilities: _enclosing callable scope lookup_. **/
	private enclosing_scope(node: ts.Node): ts.Node {
		let current = node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				return current;
			}
			current = current.parent;
		}
		return current;
	}

	/** Responsibilities: _callable alias initialization_. **/
	public constructor(fake_object: FakeObjectContract) {
		this.binding = new ObjectCallableBinding(fake_object);
		this.scope_aliases = new WeakMap<ts.Node, ReadonlySet<string>>();
	}

	/** Responsibilities: _callable alias names_. **/
	public names(node: ts.Node): ReadonlySet<string> {
		const scope = this.enclosing_scope(node);
		const cached = this.scope_aliases.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const aliases = new Set<string>();
		let changed = true;
		while (changed) {
			changed = this.binding.append_scope(aliases, scope);
		}
		this.scope_aliases.set(scope, aliases);
		return aliases;
	}

	/** Responsibilities: _callable alias classification_. **/
	public contains(expression: ts.Expression, node: ts.Node): boolean {
		if (!ts.isIdentifier(expression)) {
			return false;
		}
		return this.names(node).has(expression.text);
	}
}
