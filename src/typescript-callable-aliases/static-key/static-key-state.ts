import ts from "typescript";
import { TypeScriptStaticArrayAliases } from "src/typescript-callable-aliases/static-key/static-array-aliases";
import { TypeScriptStaticObjectBindings } from "src/typescript-callable-aliases/static-key/static-object-bindings";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/typescript-expression-aliases";
import type { StaticKeyCollectionState } from "src/typescript-callable-aliases/types";

/** Responsibilities: _static key state collection_. **/
export class TypeScriptStaticKeyState {
	private readonly expression_aliases = new TypeScriptExpressionAliases("");
	private readonly object_bindings = new TypeScriptStaticObjectBindings();
	private readonly static_key_kinds = new Set([
		ts.SyntaxKind.StringLiteral,
		ts.SyntaxKind.NoSubstitutionTemplateLiteral,
		ts.SyntaxKind.NumericLiteral,
	]);

	/** Responsibilities: _static literal key extension_. **/
	private append_literal(values: Map<string, string>, name: string, current: ts.Expression): boolean {
		const value = current.getText().replace(/^['"`]|['"`]$/g, "");
		if (values.has(name)) {
			return false;
		}
		if (value.length === 0) {
			return false;
		}
		values.set(name, value);
		return true;
	}

	/** Responsibilities: _static alias key extension_. **/
	private append_alias(values: Map<string, string>, name: string, current: ts.Identifier): boolean {
		const value = values.get(current.text);
		if (value === undefined) {
			return false;
		}
		if (values.has(name)) {
			return false;
		}
		values.set(name, value);
		return true;
	}

	/** Responsibilities: _static key value extension_. **/
	private append_value(values: Map<string, string>, name: string, initializer: ts.Expression): boolean {
		const current = this.expression_aliases.unwrapped(initializer);
		if (this.static_key_kinds.has(current.kind)) {
			return this.append_literal(values, name, current);
		}
		if (!ts.isIdentifier(current)) {
			return false;
		}
		return this.append_alias(values, name, current);
	}

	/** Responsibilities: _static key array declaration_. **/
	private append_array_declaration(
		values: Map<string, string>,
		arrays: Map<string, readonly ts.Expression[]>,
		node: ts.VariableDeclaration,
	): boolean {
		const array_aliases = new TypeScriptStaticArrayAliases(values, arrays);
		if (array_aliases.append_source(node)) {
			return true;
		}
		if (ts.isArrayBindingPattern(node.name)) {
			return array_aliases.append_declaration(node);
		}
		return false;
	}

	/** Responsibilities: _static key declaration collection_. **/
	private append_declaration(
		values: Map<string, string>,
		objects: Map<string, ts.ObjectLiteralExpression>,
		arrays: Map<string, readonly ts.Expression[]>,
		node: ts.Node,
	): boolean {
		if (!ts.isVariableDeclaration(node)) {
			return false;
		}
		if (node.initializer === undefined) {
			return false;
		}
		if (this.object_bindings.append(values, objects, node)) {
			return true;
		}
		if (this.append_array_declaration(values, arrays, node)) {
			return true;
		}
		if (!ts.isIdentifier(node.name)) {
			return false;
		}
		return this.append_value(values, node.name.text, node.initializer);
	}

	/** Responsibilities: _static key assignment collection_. **/
	private append_assignment(values: Map<string, string>, node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		let changed = this.object_bindings.append_assignment(node);
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return changed;
		}
		if (!ts.isIdentifier(node.left)) {
			return changed;
		}
		if (this.append_value(values, node.left.text, node.right)) {
			changed = true;
		}
		return changed;
	}

	/** Responsibilities: _static key scope collection_. **/
	private append_node(
		values: Map<string, string>,
		objects: Map<string, ts.ObjectLiteralExpression>,
		arrays: Map<string, readonly ts.Expression[]>,
		node: ts.Node,
		root: ts.Node,
	): boolean {
		let changed = this.append_declaration(values, objects, arrays, node);
		if (this.append_assignment(values, node)) {
			changed = true;
		}
		if (node !== root) {
			if (ts.isFunctionLike(node)) {
				return changed;
			}
		}
		node.forEachChild((child) => {
			if (this.append_node(values, objects, arrays, child, root)) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _static key state collection_. **/
	public collect(scope: ts.Node): StaticKeyCollectionState {
		const values = new Map<string, string>();
		const objects = new Map<string, ts.ObjectLiteralExpression>();
		const arrays = new Map<string, readonly ts.Expression[]>();
		let changed = true;
		while (changed) {
			changed = this.append_node(values, objects, arrays, scope, scope);
		}
		return { values, objects };
	}

	/** Responsibilities: _static key values collection_. **/
	public values(scope: ts.Node): ReadonlyMap<string, string> {
		return this.collect(scope).values;
	}
}
