import ts from "typescript";
import type { FakeObjectProtocol } from "src/protocols";
import { ObjectDestructuredAliases } from "src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/object-literal-aliases/object-destructured-aliases";
import { TypeScriptExpressionNames } from "src/typescript-aliases/typescript-expression-names";

/** Responsibilities: _resolution object literal aliases_. **/
export class ObjectLiteralAliases {
	private readonly expression_names = new TypeScriptExpressionNames();
	private readonly fake_object: FakeObjectProtocol;
	private readonly destructured_aliases: ObjectDestructuredAliases;
	private readonly scope_aliases = new Map<ts.Node, ReadonlySet<string>>();

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

	/** Responsibilities: _fake object alias classification_. **/
	private fake_object_expression(expression: ts.Expression): boolean {
		const current = this.expression_names.unwrap_transparent_expression(expression);
		if (!ts.isObjectLiteralExpression(current)) {
			return false;
		}
		return this.fake_object.fake_object(current);
	}

	/** Responsibilities: _named object alias extension_. **/
	private append_named_alias(aliases: Set<string>, name: string, value: ts.Identifier): boolean {
		if (!aliases.has(value.text) || aliases.has(name)) {
			return false;
		}
		aliases.add(name);
		return true;
	}

	/** Responsibilities: _object alias extension_. **/
	private append_alias(aliases: Set<string>, node: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(node.name) || node.initializer === undefined) {
			return false;
		}
		if (aliases.has(node.name.text)) {
			return false;
		}
		if (this.fake_object_expression(node.initializer)) {
			aliases.add(node.name.text);
			return true;
		}
		if (!ts.isIdentifier(node.initializer)) {
			return false;
		}
		return this.append_named_alias(aliases, node.name.text, node.initializer);
	}

	/** Responsibilities: _scope object aliases_. **/
	private append_scope_aliases(aliases: Set<string>, node: ts.Node): boolean {
		let changed = false;
		if (ts.isVariableDeclaration(node) && this.append_alias(aliases, node)) {
			changed = true;
		}
		node.forEachChild((child) => {
			if (this.append_scope_aliases(aliases, child)) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _object alias names collection_. **/
	private collect(node: ts.Node): ReadonlySet<string> {
		const cached = this.scope_aliases.get(node);
		if (cached !== undefined) {
			return cached;
		}
		const aliases = new Set<string>();
		let changed = true;
		while (changed) {
			changed = this.append_scope_aliases(aliases, node);
		}
		this.scope_aliases.set(node, aliases);
		return aliases;
	}

	/** Responsibilities: _object alias resolver initialization_. **/
	public constructor(fake_object: FakeObjectProtocol) {
		this.fake_object = fake_object;
		this.destructured_aliases = new ObjectDestructuredAliases(fake_object);
	}

	/** Responsibilities: _object alias names resolution_. **/
	public names(node: ts.Node): ReadonlySet<string> {
		const names = new Set(this.collect(this.enclosing_scope(node)));
		for (const name of this.destructured_aliases.names(node)) {
			names.add(name);
		}
		return names;
	}

	/** Responsibilities: _object alias classification_. **/
	public contains(expression: ts.Expression, node: ts.Node): boolean {
		if (!ts.isIdentifier(expression)) {
			return false;
		}
		return this.names(node).has(expression.text);
	}
}
