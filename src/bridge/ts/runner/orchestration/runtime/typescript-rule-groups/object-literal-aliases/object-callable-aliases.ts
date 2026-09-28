import ts from 'typescript';
import type { FakeObjectProtocol } from 'src/protocols';
import { ObjectCallableBinding } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/object-literal-aliases/object-callable-binding';

/** Responsibilities: _resolution callable object aliases_. **/
export class ObjectCallableAliases {
	private readonly binding: ObjectCallableBinding;

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
	public constructor(fake_object: FakeObjectProtocol) {
		this.binding = new ObjectCallableBinding(fake_object);
	}

	/** Responsibilities: _callable alias names_. **/
	public names(node: ts.Node): ReadonlySet<string> {
		const aliases = new Set<string>();
		let changed = true;
		const scope = this.enclosing_scope(node);
		while (changed) {
			changed = this.binding.append_scope(aliases, scope);
		}
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
