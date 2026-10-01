import ts from "typescript";
import type { FakeObjectProtocol } from "src/protocols";
import { TypeScriptExpressionNames } from "src/typescript-aliases/typescript-expression-names";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/typescript-expression-aliases";

/** Responsibilities: _resolution destructured object aliases_. **/
export class ObjectDestructuredAliases {
	private readonly expression_names = new TypeScriptExpressionNames();
	private readonly fake_object: FakeObjectProtocol;
	private readonly expression_aliases = new TypeScriptExpressionAliases("");

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

	/** Responsibilities: _object alias name_. **/
	private append_name(aliases: Set<string>, name: string): boolean {
		if (name === "") {
			return false;
		}
		if (aliases.has(name)) {
			return false;
		}
		aliases.add(name);
		return true;
	}

	/** Responsibilities: _callable nested alias_. **/
	private append_value(aliases: Set<string>, name: string, value: ts.Expression): boolean {
		const current = this.expression_aliases.unwrapped(value);
		if (ts.isIdentifier(current) && aliases.has(current.text)) {
			return this.append_name(aliases, name);
		}
		if (!this.fake_object.fake_object(current)) {
			return false;
		}
		return this.append_name(aliases, name);
	}

	/** Responsibilities: _nested object aliases_. **/
	private append_nested(aliases: Set<string>, binding: ts.BindingName, value: ts.Expression): boolean {
		const current = this.expression_aliases.unwrapped(value);
		if (ts.isIdentifier(binding)) {
			return this.append_value(aliases, binding.text, current);
		}
		if (ts.isObjectBindingPattern(binding) && ts.isObjectLiteralExpression(current)) {
			return this.append_object_elements(aliases, binding, current);
		}
		if (ts.isArrayBindingPattern(binding) && ts.isArrayLiteralExpression(current)) {
			return this.append_array_elements(aliases, binding, current);
		}
		return false;
	}

	/** Responsibilities: _object alias element_. **/
	private append_element(
		aliases: Set<string>,
		element: ts.BindingElement,
		initializer: ts.ObjectLiteralExpression,
	): boolean {
		const source_name = this.expression_names.static_binding_name(element);
		const property = initializer.properties.find(
			(candidate) => this.expression_names.static_element_name(candidate) === source_name,
		);
		if (property === undefined || !ts.isPropertyAssignment(property)) {
			return false;
		}
		return this.append_nested(aliases, element.name, property.initializer);
	}

	/** Responsibilities: _object alias elements_. **/
	private append_object_elements(
		aliases: Set<string>,
		binding: ts.ObjectBindingPattern,
		initializer: ts.ObjectLiteralExpression,
	): boolean {
		let changed = false;
		for (const element of binding.elements) {
			if (!ts.isBindingElement(element)) {
				continue;
			}
			if (this.append_element(aliases, element, initializer)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _array alias elements_. **/
	private append_array_elements(
		aliases: Set<string>,
		binding: ts.ArrayBindingPattern,
		initializer: ts.ArrayLiteralExpression,
	): boolean {
		let changed = false;
		for (let index = 0; index < binding.elements.length; index += 1) {
			const element = binding.elements[index];
			const value = initializer.elements[index];
			if (element === undefined || value === undefined || ts.isSpreadElement(value)) {
				continue;
			}
			if (ts.isBindingElement(element) && this.append_nested(aliases, element.name, value)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _destructured alias binding_. **/
	private append_binding(aliases: Set<string>, node: ts.VariableDeclaration): boolean {
		if (node.initializer === undefined) {
			return false;
		}
		const initializer = this.expression_aliases.unwrapped(node.initializer);
		if (ts.isObjectBindingPattern(node.name) && ts.isObjectLiteralExpression(initializer)) {
			return this.append_object_elements(aliases, node.name, initializer);
		}
		if (ts.isArrayBindingPattern(node.name) && ts.isArrayLiteralExpression(initializer)) {
			return this.append_array_elements(aliases, node.name, initializer);
		}
		return false;
	}

	/** Responsibilities: _scope destructured aliases_. **/
	private append_scope(aliases: Set<string>, node: ts.Node): boolean {
		let changed = false;
		if (ts.isVariableDeclaration(node) && this.append_binding(aliases, node)) {
			changed = true;
		}
		node.forEachChild((child) => {
			if (this.append_scope(aliases, child)) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _destructured alias initialization_. **/
	public constructor(fake_object: FakeObjectProtocol) {
		this.fake_object = fake_object;
	}

	/** Responsibilities: _destructured alias names_. **/
	public names(node: ts.Node): ReadonlySet<string> {
		const aliases = new Set<string>();
		let changed = true;
		const scope = this.enclosing_scope(node);
		while (changed) {
			changed = this.append_scope(aliases, scope);
		}
		return aliases;
	}

	/** Responsibilities: _destructured alias classification_. **/
	public contains(expression: ts.Expression, node: ts.Node): boolean {
		if (!ts.isIdentifier(expression)) {
			return false;
		}
		return this.names(node).has(expression.text);
	}
}
