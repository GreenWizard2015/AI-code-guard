import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { FakeObjectContract, ObjectCallableBindingContract } from "src/shared_services_protocols";
import ts from "typescript";

/** Responsibilities: _destructured alias collection_, _callable binding extraction_. **/
export class ObjectCallableBinding implements ObjectCallableBindingContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _fake_object: FakeObjectContract;
	private readonly _scope: ts.Node;
	private readonly _aliases: Set<string>;

	/** Responsibilities: _callable name alias_. **/
	private append_name(name: string): boolean {
		if (name === "") {
			return false;
		}
		if (this._aliases.has(name)) {
			return false;
		}
		this._aliases.add(name);
		return true;
	}

	/** Responsibilities: _callable value alias_. **/
	private append_value(name: string, callable_expression: ts.Expression): boolean {
		if (!ts.isArrowFunction(callable_expression) && !ts.isFunctionExpression(callable_expression)) {
			return false;
		}
		return this.append_name(name);
	}

	/** Responsibilities: _nested callable binding_. **/
	private append_nested(binding: ts.BindingName, binding_initializer: ts.Expression): boolean {
		if (ts.isIdentifier(binding)) {
			return this.append_value(binding.text, binding_initializer);
		}
		if (ts.isObjectBindingPattern(binding) && ts.isObjectLiteralExpression(binding_initializer)) {
			return this.append_object_elements(binding, binding_initializer);
		}
		if (ts.isArrayBindingPattern(binding) && ts.isArrayLiteralExpression(binding_initializer)) {
			return this.append_array_elements(binding, binding_initializer);
		}
		return false;
	}

	/** Responsibilities: _callable object element_. **/
	private append_element(element: ts.BindingElement, initializer: ts.ObjectLiteralExpression): boolean {
		const source_name = this._expression_names.static_binding_name(element);
		const property = initializer.properties.find(
			(candidate) => this._expression_names.static_element_name(candidate) === source_name,
		);
		if (property === undefined) {
			return false;
		}
		if (this._fake_object.callable_member(property)) {
			if (ts.isIdentifier(element.name)) {
				return this.append_name(element.name.text);
			}
		}
		if (!ts.isPropertyAssignment(property)) {
			return false;
		}
		return this.append_nested(element.name, property.initializer);
	}

	/** Responsibilities: _callable object elements_. **/
	private append_object_elements(binding: ts.ObjectBindingPattern, initializer: ts.ObjectLiteralExpression): boolean {
		let changed = false;
		for (const element of binding.elements) {
			if (!ts.isBindingElement(element)) {
				continue;
			}
			if (this.append_element(element, initializer)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _callable array element_. **/
	private append_array_element(element: ts.ArrayBindingElement, array_item: ts.Expression): boolean {
		if (!ts.isBindingElement(element) || element.dotDotDotToken) {
			return false;
		}
		return this.append_nested(element.name, array_item);
	}

	/** Responsibilities: _array binding element matching_. **/
	private append_binding_element(
		binding: ts.ArrayBindingPattern,
		initializer: ts.ArrayLiteralExpression,
		index: number,
	): boolean {
		const element = binding.elements[index];
		if (element === undefined) {
			return false;
		}
		const value = initializer.elements[index];
		if (value === undefined) {
			return false;
		}
		if (value.kind === ts.SyntaxKind.OmittedExpression) {
			return false;
		}
		if (ts.isSpreadElement(value)) {
			return false;
		}
		return this.append_array_element(element, value);
	}

	/** Responsibilities: _callable array elements_. **/
	private append_array_elements(binding: ts.ArrayBindingPattern, initializer: ts.ArrayLiteralExpression): boolean {
		let changed = false;
		for (let index = 0; index < binding.elements.length; index += 1) {
			if (this.append_binding_element(binding, initializer, index)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _callable named alias_. **/
	private append_named_binding(alias_name: ts.Identifier, source_name: ts.Identifier): boolean {
		if (!this._aliases.has(source_name.text)) {
			return false;
		}
		if (this._aliases.has(alias_name.text)) {
			return false;
		}
		this._aliases.add(alias_name.text);
		return true;
	}

	/** Responsibilities: _callable declaration aliases_. **/
	private append_declaration(declaration: ts.VariableDeclaration): boolean {
		const initializer = declaration.initializer;
		if (initializer === undefined) {
			return false;
		}
		if (ts.isIdentifier(declaration.name) && ts.isIdentifier(initializer)) {
			return this.append_named_binding(declaration.name, initializer);
		}
		if (ts.isObjectBindingPattern(declaration.name) && ts.isObjectLiteralExpression(initializer)) {
			return this.append_object_elements(declaration.name, initializer);
		}
		if (ts.isArrayBindingPattern(declaration.name) && ts.isArrayLiteralExpression(initializer)) {
			return this.append_array_elements(declaration.name, initializer);
		}
		return false;
	}

	/** Responsibilities: _scope callable aliases_. **/
	private append_scope(node: ts.Node): boolean {
		let changed = false;
		if (ts.isVariableDeclaration(node) && this.append_declaration(node)) {
			changed = true;
		}
		node.forEachChild((child) => {
			if (this.append_scope(child)) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _callable binding initialization_. **/
	public constructor(fake_object: FakeObjectContract, scope: ts.Node) {
		this._expression_names = new TypeScriptExpressionNames();
		this._fake_object = fake_object;
		this._scope = scope;
		this._aliases = new Set<string>();
	}

	/** Responsibilities: _scope callable alias collection_. **/
	public collect(): ReadonlySet<string> {
		let changed = true;
		while (changed) {
			changed = this.append_scope(this._scope);
		}
		return this._aliases;
	}
}
