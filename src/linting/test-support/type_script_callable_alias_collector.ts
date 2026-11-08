import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _callable alias scope collection_, _callable alias names_. **/
export class TypeScriptCallableAliasCollector {
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly _root: ts.Node;
	private readonly _aliases: Set<string>;
	private readonly _arrays: Map<string, ts.ArrayLiteralExpression>;

	/** Responsibilities: _callable alias name extension_. **/
	private append_name(callable_name: string): boolean {
		if (callable_name.length === 0 || this._aliases.has(callable_name)) {
			return false;
		}
		this._aliases.add(callable_name);
		return true;
	}

	/** Responsibilities: _callable alias assignment_. **/
	private append_assignment(alias_name: string, value: ts.Expression): boolean {
		const current = this._expression_aliases.unwrapped(value);
		if ((ts.isArrowFunction(current) || ts.isFunctionExpression(current)) && this.append_name(alias_name)) {
			return true;
		}
		if (!ts.isIdentifier(current) || !this._aliases.has(current.text)) {
			return false;
		}
		return this.append_name(alias_name);
	}

	/** Responsibilities: _callable array alias indexing_. **/
	private append_array_alias(array_name: string, initializer: ts.Expression): void {
		const current = this._expression_aliases.unwrapped(initializer);
		if (ts.isArrayLiteralExpression(current)) {
			this._arrays.set(array_name, current);
			return;
		}
		if (!ts.isIdentifier(current)) {
			return;
		}
		const array = this._arrays.get(current.text);
		if (array !== undefined) {
			this._arrays.set(array_name, array);
		}
	}

	/** Responsibilities: _callable variable binding_. **/
	private append_variable(declaration: ts.VariableDeclaration): boolean {
		if (declaration.initializer === undefined) {
			return false;
		}
		if (ts.isArrayBindingPattern(declaration.name)) {
			return this.append_array_binding(declaration.name, declaration.initializer);
		}
		if (!ts.isIdentifier(declaration.name)) {
			return false;
		}
		this.append_array_alias(declaration.name.text, declaration.initializer);
		return this.append_assignment(declaration.name.text, declaration.initializer);
	}

	/** Responsibilities: _callable array element binding_. **/
	private append_array_elements(binding: ts.ArrayBindingPattern, values: ts.ArrayLiteralExpression): boolean {
		let changed = false;
		binding.elements.forEach((element, index) => {
			const value = values.elements[index];
			if (value === undefined) {
				return;
			}
			if (!ts.isBindingElement(element)) {
				return;
			}
			if (ts.isIdentifier(element.name) && this.append_assignment(element.name.text, value)) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _callable array destructuring_. **/
	private append_array_binding(binding: ts.ArrayBindingPattern, initializer: ts.Expression): boolean {
		const current = this._expression_aliases.unwrapped(initializer);
		if (ts.isArrayLiteralExpression(current)) {
			return this.append_array_elements(binding, current);
		}
		if (ts.isIdentifier(current)) {
			const values = this._arrays.get(current.text);
			if (values !== undefined) {
				return this.append_array_elements(binding, values);
			}
		}
		return false;
	}

	/** Responsibilities: _callable declaration naming_. **/
	private append_function(declaration: ts.FunctionDeclaration): boolean {
		const name = declaration.name;
		if (name === undefined) {
			return false;
		}
		return this.append_name(name.text);
	}

	/** Responsibilities: _callable declaration indexing_. **/
	private append_declaration(node: ts.Node): boolean {
		if (ts.isFunctionDeclaration(node)) {
			return this.append_function(node);
		}
		if (ts.isVariableDeclaration(node)) {
			return this.append_variable(node);
		}
		return false;
	}

	/** Responsibilities: _callable reassignment indexing_. **/
	private append_assignment_node(assignment: ts.BinaryExpression): boolean {
		if (assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		if (!ts.isIdentifier(assignment.left)) {
			return false;
		}
		return this.append_assignment(assignment.left.text, assignment.right);
	}

	/** Responsibilities: _callable alias tree traversal_. **/
	private append_node(node: ts.Node): boolean {
		let changed = this.append_declaration(node);
		if (ts.isBinaryExpression(node) && this.append_assignment_node(node)) {
			changed = true;
		}
		if (node !== this._root && ts.isFunctionLike(node)) {
			return changed;
		}
		node.forEachChild((child) => {
			if (this.append_node(child)) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _callable alias indexing initialization_. **/
	public constructor(root: ts.Node, expression_aliases: TypeScriptExpressionAliasesContract) {
		this._root = root;
		this._expression_aliases = expression_aliases;
		this._aliases = new Set();
		this._arrays = new Map();
	}

	/** Responsibilities: _callable scope traversal_. **/
	public collect(): void {
		this._aliases.clear();
		this._arrays.clear();
		let changed = true;
		while (changed) {
			changed = this.append_node(this._root);
		}
	}

	/** Responsibilities: _callable alias name access_. **/
	public names(): ReadonlySet<string> {
		return this._aliases;
	}
}
