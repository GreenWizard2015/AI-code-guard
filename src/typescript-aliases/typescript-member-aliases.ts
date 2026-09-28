import ts from 'typescript';
import { TypeScriptMemberBinding } from 'src/typescript-aliases/typescript-member-binding';

/** Responsibilities: _resolution TypeScript member aliases_. **/
export class TypeScriptMemberAliases {
	private readonly bindings: TypeScriptMemberBinding;

	/** Responsibilities: _member alias names resolution_. **/
	private properties(node: ts.Node): Map<string, Set<string>> {
		const aliases = new Map<string, Set<string>>();
		let current = node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				this.merge(aliases, this.bindings.collect(current));
			}
			current = current.parent;
		}
		this.merge(aliases, this.bindings.collect(current));
		return aliases;
	}

	/** Responsibilities: _alias map merging_. **/
	private merge(target: Map<string, Set<string>>, source: Map<string, Set<string>>): void {
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
		static_value: (expression: ts.Expression, node: ts.Node) => string
	) {
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
