import ts from "typescript";
import { TypeScriptBindingAliases } from "src/typescript-aliases/typescript-binding-aliases";
import { TypeScriptObjectAliases } from "src/typescript-aliases/typescript-object-aliases";
import type { TypeScriptExpressionAliasesProtocol, TypeScriptObjectAliasesProtocol } from "src/protocols";

/** Responsibilities: _TypeScript expression alias collection_. **/
export class TypeScriptExpressionAliasCollector {
	private readonly owner: TypeScriptExpressionAliasesProtocol;
	private readonly binding_aliases = new TypeScriptBindingAliases();

	/** Responsibilities: _pattern alias collection_. **/
	private append_pattern_alias(
		aliases: Set<string>,
		node: ts.VariableDeclaration,
		object_aliases: TypeScriptObjectAliasesProtocol,
	): boolean {
		if (node.initializer === undefined) {
			return false;
		}
		return this.binding_aliases.append_binding_aliases(
			aliases,
			node.name,
			node.initializer,
			(expression) => object_aliases.value(this.owner.unwrapped(expression)),
			(name, initializer) => this.owner.append_alias(aliases, name, initializer),
		);
	}

	/** Responsibilities: _variable alias collection_. **/
	private append_variable_alias(
		aliases: Set<string>,
		node: ts.VariableDeclaration,
		object_aliases: TypeScriptObjectAliasesProtocol,
	): boolean {
		if (node.initializer === undefined) {
			return false;
		}
		if (ts.isIdentifier(node.name)) {
			return this.owner.append_alias(aliases, node.name.text, node.initializer);
		}
		return this.append_pattern_alias(aliases, node, object_aliases);
	}

	/** Responsibilities: _assignment alias collection_. **/
	private append_assignment_alias(aliases: Set<string>, node: ts.BinaryExpression): boolean {
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		if (!ts.isIdentifier(node.left)) {
			return false;
		}
		return this.owner.append_alias(aliases, node.left.text, node.right);
	}

	/** Responsibilities: _collector initialization_. **/
	public constructor(owner: TypeScriptExpressionAliasesProtocol) {
		this.owner = owner;
	}

	/** Responsibilities: _scope alias collection_. **/
	public append_scope_aliases(
		aliases: Set<string>,
		node: ts.Node,
		root: ts.Node,
		object_aliases: TypeScriptObjectAliasesProtocol,
	): boolean {
		if (node !== root) {
			if (ts.isFunctionLike(node)) {
				return false;
			}
		}
		let changed = false;
		if (ts.isVariableDeclaration(node)) {
			changed = this.append_variable_alias(aliases, node, object_aliases);
		}
		if (ts.isBinaryExpression(node) && this.append_assignment_alias(aliases, node)) {
			changed = true;
		}
		node.forEachChild((child) => {
			if (this.append_scope_aliases(aliases, child, root, object_aliases)) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _scope alias names_. **/
	public collect(scope: ts.Node): ReadonlySet<string> {
		const aliases = new Set<string>();
		const object_aliases = new TypeScriptObjectAliases();
		object_aliases.collect(scope);
		let changed = true;
		while (changed) {
			changed = this.append_scope_aliases(aliases, scope, scope, object_aliases);
		}
		return aliases;
	}
}
