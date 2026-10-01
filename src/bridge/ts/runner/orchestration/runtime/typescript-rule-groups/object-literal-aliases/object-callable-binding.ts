import ts from "typescript";
import type { FakeObjectProtocol } from "src/protocols";
import { TypeScriptExpressionNames } from "src/typescript-aliases/typescript-expression-names";

/** Responsibilities: _collection callable object bindings_. **/
export class ObjectCallableBinding {
	private readonly expression_names = new TypeScriptExpressionNames();
	private readonly fake_object: FakeObjectProtocol;

	/** Responsibilities: _callable name alias_. **/
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

	/** Responsibilities: _callable value alias_. **/
	private append_value(aliases: Set<string>, name: string, value: ts.Expression): boolean {
		if (!ts.isArrowFunction(value) && !ts.isFunctionExpression(value)) {
			return false;
		}
		return this.append_name(aliases, name);
	}

	/** Responsibilities: _nested callable binding_. **/
	private append_nested(aliases: Set<string>, binding: ts.BindingName, value: ts.Expression): boolean {
		if (ts.isIdentifier(binding)) {
			return this.append_value(aliases, binding.text, value);
		}
		if (ts.isObjectBindingPattern(binding) && ts.isObjectLiteralExpression(value)) {
			return this.append_object_elements(aliases, binding, value);
		}
		if (ts.isArrayBindingPattern(binding) && ts.isArrayLiteralExpression(value)) {
			return this.append_array_elements(aliases, binding, value);
		}
		return false;
	}

	/** Responsibilities: _callable object element_. **/
	private append_element(
		aliases: Set<string>,
		element: ts.BindingElement,
		initializer: ts.ObjectLiteralExpression,
	): boolean {
		const source_name = this.expression_names.static_binding_name(element);
		const property = initializer.properties.find(
			(candidate) => this.expression_names.static_element_name(candidate) === source_name,
		);
		if (property === undefined) {
			return false;
		}
		if (this.fake_object.callable_member(property)) {
			if (ts.isIdentifier(element.name)) {
				return this.append_name(aliases, element.name.text);
			}
		}
		if (!ts.isPropertyAssignment(property)) {
			return false;
		}
		return this.append_nested(aliases, element.name, property.initializer);
	}

	/** Responsibilities: _callable object elements_. **/
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

	/** Responsibilities: _callable array element_. **/
	private append_array_element(aliases: Set<string>, element: ts.ArrayBindingElement, value: ts.Expression): boolean {
		if (!ts.isBindingElement(element) || element.dotDotDotToken) {
			return false;
		}
		return this.append_nested(aliases, element.name, value);
	}

	/** Responsibilities: _callable array elements_. **/
	private append_array_elements(
		aliases: Set<string>,
		binding: ts.ArrayBindingPattern,
		initializer: ts.ArrayLiteralExpression,
	): boolean {
		let changed = false;
		for (let index = 0; index < binding.elements.length; index += 1) {
			const element = binding.elements[index];
			const value = initializer.elements[index];
			if (element === undefined || value === undefined) {
				continue;
			}
			if (value.kind === ts.SyntaxKind.OmittedExpression || ts.isSpreadElement(value)) {
				continue;
			}
			if (this.append_array_element(aliases, element, value)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _callable object binding_. **/
	private append_object_binding(aliases: Set<string>, node: ts.VariableDeclaration): boolean {
		const initializer = node.initializer;
		if (!ts.isObjectBindingPattern(node.name) || initializer === undefined) {
			return false;
		}
		if (!ts.isObjectLiteralExpression(initializer)) {
			return false;
		}
		return this.append_object_elements(aliases, node.name, initializer);
	}

	/** Responsibilities: _callable array binding_. **/
	private append_array_binding(aliases: Set<string>, node: ts.VariableDeclaration): boolean {
		const initializer = node.initializer;
		if (!ts.isArrayBindingPattern(node.name) || initializer === undefined) {
			return false;
		}
		if (!ts.isArrayLiteralExpression(initializer)) {
			return false;
		}
		return this.append_array_elements(aliases, node.name, initializer);
	}

	/** Responsibilities: _callable named alias_. **/
	private append_named_binding(aliases: Set<string>, node: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(node.name) || node.initializer === undefined) {
			return false;
		}
		if (!ts.isIdentifier(node.initializer) || !aliases.has(node.initializer.text)) {
			return false;
		}
		if (aliases.has(node.name.text)) {
			return false;
		}
		aliases.add(node.name.text);
		return true;
	}

	/** Responsibilities: _callable binding initialization_. **/
	public constructor(fake_object: FakeObjectProtocol) {
		this.fake_object = fake_object;
	}

	/** Responsibilities: _callable variable binding_. **/
	public variable(aliases: Set<string>, node: ts.VariableDeclaration): boolean {
		let changed = false;
		if (this.append_named_binding(aliases, node)) {
			changed = true;
		}
		if (this.append_object_binding(aliases, node)) {
			changed = true;
		}
		if (this.append_array_binding(aliases, node)) {
			changed = true;
		}
		return changed;
	}

	/** Responsibilities: _scope callable bindings_. **/
	public append_scope(aliases: Set<string>, node: ts.Node): boolean {
		let changed = false;
		if (ts.isVariableDeclaration(node) && this.variable(aliases, node)) {
			changed = true;
		}
		node.forEachChild((child) => {
			if (this.append_scope(aliases, child)) {
				changed = true;
			}
		});
		return changed;
	}
}
