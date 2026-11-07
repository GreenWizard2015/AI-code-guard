import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { FakeObjectContract } from "src/shared_services_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _scope destructured aliases_, _nested alias propagation_. **/
export class DestructuredAliasScope {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _fake_object: FakeObjectContract;
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly _alias_names: Set<string>;

	/** Responsibilities: _alias name addition_. **/
	private append_name(name: string): boolean {
		if (name === "" || this._alias_names.has(name)) {
			return false;
		}
		this._alias_names.add(name);
		return true;
	}

	/** Responsibilities: _callable nested alias_. **/
	private append_value(name: string, value: ts.Expression): boolean {
		const current = this._expression_aliases.unwrapped(value);
		if (ts.isIdentifier(current) && this._alias_names.has(current.text)) {
			return this.append_name(name);
		}
		if (!this._fake_object.fake_object(current)) {
			return false;
		}
		return this.append_name(name);
	}

	/** Responsibilities: _nested object aliases_. **/
	private append_nested(binding: ts.BindingName, value: ts.Expression): boolean {
		const current = this._expression_aliases.unwrapped(value);
		if (ts.isIdentifier(binding)) {
			return this.append_value(binding.text, current);
		}
		if (ts.isObjectBindingPattern(binding) && ts.isObjectLiteralExpression(current)) {
			return this.append_object_elements(binding, current);
		}
		if (ts.isArrayBindingPattern(binding) && ts.isArrayLiteralExpression(current)) {
			return this.append_array_elements(binding, current);
		}
		return false;
	}

	/** Responsibilities: _object alias element_. **/
	private append_object_element(element: ts.BindingElement, initializer: ts.ObjectLiteralExpression): boolean {
		const source_name = this._expression_names.static_binding_name(element);
		const property = initializer.properties.find(
			(candidate) => this._expression_names.static_element_name(candidate) === source_name,
		);
		if (property === undefined || !ts.isPropertyAssignment(property)) {
			return false;
		}
		return this.append_nested(element.name, property.initializer);
	}

	/** Responsibilities: _object alias elements_. **/
	private append_object_elements(binding: ts.ObjectBindingPattern, initializer: ts.ObjectLiteralExpression): boolean {
		let changed = false;
		for (const element of binding.elements) {
			if (ts.isBindingElement(element) && this.append_object_element(element, initializer)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _array alias element_. **/
	private append_array_element(
		binding: ts.ArrayBindingPattern,
		initializer: ts.ArrayLiteralExpression,
		index: number,
	): boolean {
		const element = binding.elements[index];
		const value = initializer.elements[index];
		if (element === undefined || value === undefined) {
			return false;
		}
		if (ts.isSpreadElement(value)) {
			return false;
		}
		if (!ts.isBindingElement(element)) {
			return false;
		}
		return this.append_nested(element.name, value);
	}

	/** Responsibilities: _array alias elements_. **/
	private append_array_elements(binding: ts.ArrayBindingPattern, initializer: ts.ArrayLiteralExpression): boolean {
		let changed = false;
		for (let index = 0; index < binding.elements.length; index += 1) {
			if (this.append_array_element(binding, initializer, index)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _destructured alias binding_. **/
	private append_binding(node: ts.VariableDeclaration): boolean {
		if (node.initializer === undefined) {
			return false;
		}
		const initializer = this._expression_aliases.unwrapped(node.initializer);
		if (ts.isObjectBindingPattern(node.name) && ts.isObjectLiteralExpression(initializer)) {
			return this.append_object_elements(node.name, initializer);
		}
		if (ts.isArrayBindingPattern(node.name) && ts.isArrayLiteralExpression(initializer)) {
			return this.append_array_elements(node.name, initializer);
		}
		return false;
	}

	/** Responsibilities: _scope alias collection_. **/
	private append_scope(node: ts.Node): boolean {
		let changed = false;
		if (ts.isVariableDeclaration(node) && this.append_binding(node)) {
			changed = true;
		}
		node.forEachChild((child) => {
			if (this.append_scope(child)) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _scope alias initialization_. **/
	public constructor(fake_object: FakeObjectContract) {
		this._expression_names = new TypeScriptExpressionNames();
		this._expression_aliases = new TypeScriptExpressionAliases("", new TypeScriptObjectAliasDeclarationIndex());
		this._fake_object = fake_object;
		this._alias_names = new Set();
	}

	/** Responsibilities: _scope alias fixed point_. **/
	public scan(scope: ts.Node): void {
		let changed = true;
		while (changed) {
			changed = this.append_scope(scope);
		}
	}

	/** Responsibilities: _scope alias result_. **/
	public aliases(): ReadonlySet<string> {
		return this._alias_names;
	}
}
