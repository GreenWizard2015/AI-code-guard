import ts from "typescript";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/typescript-expression-aliases";
import { TypeScriptStaticObjectValues } from "src/typescript-callable-aliases/static-object-values";
import { TypeScriptStaticObjectSources } from "src/typescript-callable-aliases/static-object-sources";
import type { TypeScriptStaticObjectArgumentsProtocol } from "src/protocols";

/** Responsibilities: _static object property collection_. **/
export class TypeScriptStaticObjectProperties {
	private readonly expression_aliases = new TypeScriptExpressionAliases("");
	private readonly source_expressions: TypeScriptStaticObjectSources;
	private readonly value_resolver: TypeScriptStaticObjectValues;
	private readonly objects: Map<string, ts.ObjectLiteralExpression>;

	/** Responsibilities: _object binding source_. **/
	private append_object_binding(binding: ts.ObjectBindingPattern, initializer: ts.Expression): boolean {
		const current = this.expression_aliases.unwrapped(initializer);
		if (ts.isObjectLiteralExpression(current)) {
			return this.append_properties(binding, current);
		}
		if (!ts.isIdentifier(current)) {
			return false;
		}
		const object = this.objects.get(current.text);
		if (object === undefined) {
			return false;
		}
		return this.append_properties(binding, object);
	}

	/** Responsibilities: _array binding sources_. **/
	private append_array_binding(binding: ts.ArrayBindingPattern, initializer: ts.Expression): boolean {
		const current = this.expression_aliases.unwrapped(initializer);
		if (!ts.isArrayLiteralExpression(current)) {
			return false;
		}
		return this.append_array_elements(binding, current);
	}

	/** Responsibilities: _array binding elements_. **/
	private append_array_elements(binding: ts.ArrayBindingPattern, initializer: ts.ArrayLiteralExpression): boolean {
		let changed = false;
		for (const [index, element] of binding.elements.entries()) {
			const value = initializer.elements[index];
			if (value === undefined) {
				continue;
			}
			if (!ts.isBindingElement(element)) {
				continue;
			}
			if (this.append_array_element(element, value)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _array binding element_. **/
	private append_array_element(element: ts.BindingElement, value: ts.Expression): boolean {
		if (!ts.isIdentifier(element.name)) {
			return this.append_binding(element.name, value);
		}
		if (this.append_named_binding(element.name, value)) {
			return true;
		}
		return this.value_resolver.append_value(element.name.text, this.expression_aliases.unwrapped(value));
	}

	/** Responsibilities: _named object source_. **/
	private append_named_binding(binding: ts.Identifier, initializer: ts.Expression): boolean {
		const current = this.expression_aliases.unwrapped(initializer);
		if (ts.isObjectLiteralExpression(current)) {
			return this.value_resolver.append_object(binding.text, current);
		}
		if (!ts.isIdentifier(current)) {
			return false;
		}
		return this.value_resolver.append_object(binding.text, current);
	}

	/** Responsibilities: _named binding property_. **/
	private append_named_property(element: ts.BindingElement, initializer: ts.ObjectLiteralExpression): boolean {
		let source_name = this.value_resolver.property_name(element.name);
		if (element.propertyName !== undefined) {
			source_name = this.value_resolver.property_name(element.propertyName);
		}
		return this.value_resolver.append_property_value(initializer, source_name, new Set(), (current) =>
			this.value_resolver.append_value(element.name.getText(), this.expression_aliases.unwrapped(current)),
		);
	}

	/** Responsibilities: _nested binding property_. **/
	private append_nested_property(element: ts.BindingElement, initializer: ts.ObjectLiteralExpression): boolean {
		if (element.propertyName === undefined) {
			return false;
		}
		const source_name = this.value_resolver.property_name(element.propertyName);
		return this.value_resolver.append_property_value(initializer, source_name, new Set(), (current) =>
			this.append_binding(element.name, current),
		);
	}

	/** Responsibilities: _object alias state_. **/
	public constructor(
		values: Map<string, string>,
		objects: Map<string, ts.ObjectLiteralExpression>,
		arguments_source: TypeScriptStaticObjectArgumentsProtocol,
	) {
		this.value_resolver = new TypeScriptStaticObjectValues(values, objects);
		this.objects = objects;
		this.source_expressions = new TypeScriptStaticObjectSources(arguments_source);
	}

	/** Responsibilities: _object binding property_. **/
	public append_property(element: ts.BindingElement, initializer: ts.ObjectLiteralExpression): boolean {
		if (ts.isIdentifier(element.name)) {
			return this.append_named_property(element, initializer);
		}
		if (!ts.isObjectBindingPattern(element.name) && !ts.isArrayBindingPattern(element.name)) {
			return false;
		}
		return this.append_nested_property(element, initializer);
	}

	/** Responsibilities: _object binding properties_. **/
	public append_properties(binding: ts.ObjectBindingPattern, initializer: ts.ObjectLiteralExpression): boolean {
		let changed = false;
		for (const element of binding.elements) {
			if (element.dotDotDotToken && ts.isIdentifier(element.name)) {
				if (this.value_resolver.append_object(element.name.text, initializer)) {
					changed = true;
				}
				continue;
			}
			if (this.append_property(element, initializer)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _nested binding source_. **/
	public append_binding(binding: ts.BindingName, initializer: ts.Expression): boolean {
		const current = this.expression_aliases.unwrapped(initializer);
		if (this.source_expressions.append_binding(current, (expression) => this.append_binding(binding, expression))) {
			return true;
		}
		if (ts.isIdentifier(binding)) {
			return this.append_named_binding(binding, current);
		}
		if (ts.isObjectBindingPattern(binding)) {
			return this.append_object_binding(binding, current);
		}
		if (ts.isArrayBindingPattern(binding)) {
			return this.append_array_binding(binding, current);
		}
		return false;
	}
}
