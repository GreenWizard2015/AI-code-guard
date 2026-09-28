import ts from 'typescript';
import { TypeScriptExpressionAliases } from 'src/typescript-aliases/typescript-expression-aliases';
import { TypeScriptStaticArrayAliases } from 'src/typescript-callable-aliases/static-array-aliases';
import { TypeScriptStaticObjectBindings } from 'src/typescript-callable-aliases/static-object-bindings';
import { TypeScriptStaticObjectValues } from 'src/typescript-callable-aliases/static-object-values';
import type { StaticKeyCollectionState } from 'src/typescript-callable-aliases/types';

/** Responsibilities: _static key alias resolution_. **/
export class TypeScriptStaticKeyAliases {
	private readonly object_bindings = new TypeScriptStaticObjectBindings();
	private readonly expression_aliases = new TypeScriptExpressionAliases('');
	private readonly static_key_kinds = new Set([
		ts.SyntaxKind.StringLiteral,
		ts.SyntaxKind.NoSubstitutionTemplateLiteral,
		ts.SyntaxKind.NumericLiteral,
	]);

	/** Responsibilities: _static literal key extension_. **/
	private append_literal(values: Map<string, string>, name: string, current: ts.Expression): boolean {
		const value = current.getText().replace(/^['"`]|['"`]$/g, '');
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

	/** Responsibilities: _static key declaration collection_. **/
	private append_declaration(
		values: Map<string, string>,
		objects: Map<string, ts.ObjectLiteralExpression>,
		arrays: Map<string, readonly ts.Expression[]>,
		node: ts.Node
	): boolean {
		if (!ts.isVariableDeclaration(node) || node.initializer === undefined) {
			return false;
		}
		if (this.object_bindings.append(values, objects, node)) {
			return true;
		}
		const array_aliases = new TypeScriptStaticArrayAliases(values, arrays);
		if (array_aliases.append_source(node)) {
			return true;
		}
		if (ts.isArrayBindingPattern(node.name)) {
			return array_aliases.append_declaration(node);
		}
		if (!ts.isIdentifier(node.name)) {
			return false;
		}
		return this.append_value(values, node.name.text, node.initializer);
	}

	/** Responsibilities: _static key assignment collection_. **/
	private append_assignment(values: Map<string, string>, node: ts.Node): boolean {
		let changed = false;
		if (ts.isBinaryExpression(node)) {
			if (this.object_bindings.append_assignment(node)) {
				changed = true;
			}
		}
		if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
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
		root: ts.Node
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
		node.forEachChild(child => {
			if (this.append_node(values, objects, arrays, child, root)) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _static key state collection_. **/
	private collect_state(scope: ts.Node): StaticKeyCollectionState {
		const values = new Map<string, string>();
		const objects = new Map<string, ts.ObjectLiteralExpression>();
		const arrays = new Map<string, readonly ts.Expression[]>();
		let changed = true;
		while (changed) {
			changed = this.append_node(values, objects, arrays, scope, scope);
		}
		return { values, objects };
	}

	/** Responsibilities: _static key scope lookup_. **/
	private scopes(node: ts.Node): ts.Node[] {
		const scopes: ts.Node[] = [];
		let current = node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				scopes.push(current);
			}
			current = current.parent;
		}
		scopes.push(current);
		return scopes;
	}

	/** Responsibilities: _static object property lookup_. **/
	private object_property_value(
		object: ts.Expression,
		property_name: string,
		node: ts.Node
	): string {
		const object_expression = this.expression_aliases.unwrapped(object);
		if (!ts.isIdentifier(object_expression)) {
			return '';
		}
		for (const scope of this.scopes(node)) {
			const state = this.collect_state(scope);
			const source = state.objects.get(object_expression.text);
			if (source === undefined) {
				continue;
			}
			const value_resolver = new TypeScriptStaticObjectValues(state.values, state.objects);
			return value_resolver.property_value(
				source,
				property_name
			);
		}
		return '';
	}

	/** Responsibilities: _static key alias values_. **/
	public values(node: ts.Node): ReadonlyMap<string, string> {
		const values = new Map<string, string>();
		for (const scope of this.scopes(node)) {
			for (const [name, value] of this.collect_state(scope).values) {
				values.set(name, value);
			}
		}
		return values;
	}

	/** Responsibilities: _static key alias resolution_. **/
	public value(expression: ts.Expression, node: ts.Node): string {
		const current = this.expression_aliases.unwrapped(expression);
		if (!ts.isIdentifier(current)) {
			return '';
		}
		const value = this.values(node).get(current.text);
		if (value === undefined) {
			return '';
		}
		return value;
	}

	/** Responsibilities: _static object property resolution_. **/
	public object_property(expression: ts.Expression, node: ts.Node): string {
		const current = this.expression_aliases.unwrapped(expression);
		if (ts.isPropertyAccessExpression(current)) {
			return this.object_property_value(current.expression, current.name.text, node);
		}
		if (!ts.isElementAccessExpression(current)) {
			return '';
		}
		if (current.argumentExpression === undefined) {
			return '';
		}
		const property_name = this.value(current.argumentExpression, node);
		return this.object_property_value(current.expression, property_name, node);
	}
}
