import ts from "typescript";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/typescript-expression-aliases";

/** Responsibilities: _resolution callable binding aliases_. **/
export class TypeScriptCallableAliases {
	private readonly expression_aliases = new TypeScriptExpressionAliases("");

	/** Responsibilities: _callable alias name extension_. **/
	private append_name(aliases: Set<string>, name: string): boolean {
		if (name.length === 0 || aliases.has(name)) {
			return false;
		}
		aliases.add(name);
		return true;
	}

	/** Responsibilities: _callable alias assignment_. **/
	private append_assignment(aliases: Set<string>, name: string, value: ts.Expression): boolean {
		const current = this.expression_aliases.unwrapped(value);
		if ((ts.isArrowFunction(current) || ts.isFunctionExpression(current)) && this.append_name(aliases, name)) {
			return true;
		}
		if (!ts.isIdentifier(current) || !aliases.has(current.text)) {
			return false;
		}
		return this.append_name(aliases, name);
	}

	/** Responsibilities: _callable binding declaration_. **/
	private append_array_alias(
		arrays: Map<string, ts.ArrayLiteralExpression>,
		name: string,
		initializer: ts.Expression,
	): void {
		const current = this.expression_aliases.unwrapped(initializer);
		if (ts.isArrayLiteralExpression(current)) {
			arrays.set(name, current);
			return;
		}
		if (!ts.isIdentifier(current)) {
			return;
		}
		const array = arrays.get(current.text);
		if (array !== undefined) {
			arrays.set(name, array);
		}
	}

	/** Responsibilities: _callable binding declaration_. **/
	private append_variable(
		aliases: Set<string>,
		node: ts.VariableDeclaration,
		arrays: Map<string, ts.ArrayLiteralExpression>,
	): boolean {
		if (node.initializer === undefined) {
			return false;
		}
		if (ts.isArrayBindingPattern(node.name)) {
			return this.append_array_binding(aliases, node.name, node.initializer, arrays);
		}
		if (!ts.isIdentifier(node.name)) {
			return false;
		}
		this.append_array_alias(arrays, node.name.text, node.initializer);
		return this.append_assignment(aliases, node.name.text, node.initializer);
	}

	/** Responsibilities: _callable array elements_. **/
	private append_array_elements(
		aliases: Set<string>,
		binding: ts.ArrayBindingPattern,
		values: ts.ArrayLiteralExpression,
	): boolean {
		let changed = false;
		for (let index = 0; index < binding.elements.length; index += 1) {
			const element = binding.elements[index];
			const value = values.elements[index];
			if (!ts.isBindingElement(element) || value === undefined) {
				continue;
			}
			if (ts.isIdentifier(element.name) && this.append_assignment(aliases, element.name.text, value)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _callable array destructuring_. **/
	private append_array_binding(
		aliases: Set<string>,
		binding: ts.ArrayBindingPattern,
		initializer: ts.Expression,
		arrays: Map<string, ts.ArrayLiteralExpression>,
	): boolean {
		const current = this.expression_aliases.unwrapped(initializer);
		if (ts.isArrayLiteralExpression(current)) {
			return this.append_array_elements(aliases, binding, current);
		}
		if (ts.isIdentifier(current)) {
			const values = arrays.get(current.text);
			if (values !== undefined) {
				return this.append_array_elements(aliases, binding, values);
			}
		}
		return false;
	}

	/** Responsibilities: _callable function declaration_. **/
	private append_function(aliases: Set<string>, node: ts.FunctionDeclaration): boolean {
		const name = node.name;
		if (name === undefined) {
			return false;
		}
		return this.append_name(aliases, name.text);
	}

	/** Responsibilities: _callable alias node collection_. **/
	private append_declaration(
		aliases: Set<string>,
		node: ts.Node,
		arrays: Map<string, ts.ArrayLiteralExpression>,
	): boolean {
		if (ts.isFunctionDeclaration(node)) {
			return this.append_function(aliases, node);
		}
		if (!ts.isVariableDeclaration(node)) {
			return false;
		}
		return this.append_variable(aliases, node, arrays);
	}

	/** Responsibilities: _callable assignment node collection_. **/
	private append_assignment_node(aliases: Set<string>, node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		if (!ts.isIdentifier(node.left)) {
			return false;
		}
		return this.append_assignment(aliases, node.left.text, node.right);
	}

	/** Responsibilities: _callable alias node collection_. **/
	private append_node(
		aliases: Set<string>,
		node: ts.Node,
		root: ts.Node,
		arrays: Map<string, ts.ArrayLiteralExpression>,
	): boolean {
		let changed = this.append_declaration(aliases, node, arrays);
		if (this.append_assignment_node(aliases, node)) {
			changed = true;
		}
		if (node !== root && ts.isFunctionLike(node)) {
			return changed;
		}
		node.forEachChild((child) => {
			if (this.append_node(aliases, child, root, arrays)) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _callable scope alias collection_. **/
	private collect(scope: ts.Node): ReadonlySet<string> {
		const aliases = new Set<string>();
		const arrays = new Map<string, ts.ArrayLiteralExpression>();
		let changed = true;
		while (changed) {
			changed = this.append_node(aliases, scope, scope, arrays);
		}
		return aliases;
	}

	/** Responsibilities: _callable alias scope lookup_. **/
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

	/** Responsibilities: _callable alias names resolution_. **/
	public names(node: ts.Node): ReadonlySet<string> {
		const names = new Set<string>();
		for (const scope of this.scopes(node)) {
			for (const name of this.collect(scope)) {
				names.add(name);
			}
		}
		return names;
	}

	/** Responsibilities: _callable alias classification_. **/
	public contains(expression: ts.Expression, node: ts.Node): boolean {
		const current = this.expression_aliases.unwrapped(expression);
		if (!ts.isIdentifier(current)) {
			return false;
		}
		const names = this.names(node);
		return names.has(current.text);
	}
}
