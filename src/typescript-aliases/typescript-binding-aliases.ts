import ts from 'typescript';
import { static_binding_name, static_property_name } from 'functions';

/** Responsibilities: _TypeScript binding alias resolution_. **/
export class TypeScriptBindingAliases {
	private readonly property_names = new WeakMap<ts.Node, string>();

	/** Responsibilities: _destructured property name_. **/
	private resolve_property_name(element: ts.Node): string {
		if (ts.isBindingElement(element)) {
			return static_binding_name(element);
		}
		return static_property_name(element);
	}

	/** Responsibilities: _object property alias_. **/
	private append_object_property(
		binding: ts.BindingElement,
		property: ts.ObjectLiteralElementLike,
		property_name_value: string,
		append_binding_alias: (binding: ts.BindingName, initializer: ts.Expression) => boolean,
		normalize_initializer: (expression: ts.Expression) => ts.Expression
	): boolean {
		if (ts.isPropertyAssignment(property)) {
			if (this.property_name(property.name) !== property_name_value) {
				return false;
			}
			return append_binding_alias(binding.name, property.initializer);
		}
		if (ts.isShorthandPropertyAssignment(property) && property.name.text === property_name_value) {
			return append_binding_alias(binding.name, property.name);
		}
		if (ts.isSpreadAssignment(property)) {
			const spread_value = normalize_initializer(property.expression);
			if (ts.isObjectLiteralExpression(spread_value)) {
				return this.append_object_binding(binding, spread_value, append_binding_alias, normalize_initializer);
			}
		}
		return false;
	}

	/** Responsibilities: _object binding property_. **/
	private append_object_binding(
		element: ts.BindingElement,
		initializer: ts.ObjectLiteralExpression,
		append_binding_alias: (binding: ts.BindingName, initializer: ts.Expression) => boolean,
		normalize_initializer: (expression: ts.Expression) => ts.Expression
	): boolean {
		if (element.dotDotDotToken) {
			return false;
		}
		const property_name_value = this.property_name(element);
		if (property_name_value === '') {
			return false;
		}
		let changed = false;
		for (const property of initializer.properties) {
			if (this.append_object_property(element, property, property_name_value, append_binding_alias, normalize_initializer)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _object binding aliases_. **/
	private append_object_aliases(
		binding: ts.ObjectBindingPattern,
		initializer: ts.ObjectLiteralExpression,
		append_binding_alias: (binding: ts.BindingName, initializer: ts.Expression) => boolean,
		normalize_initializer: (expression: ts.Expression) => ts.Expression
	): boolean {
		let changed = false;
		for (const element of binding.elements) {
			if (this.append_object_binding(element, initializer, append_binding_alias, normalize_initializer)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _spread binding item_. **/
	private spread_binding_item(
		element: ts.BindingElement,
		item: ts.SpreadElement,
		append_binding_alias: (binding: ts.BindingName, initializer: ts.Expression) => boolean,
		normalize_initializer: (expression: ts.Expression) => ts.Expression
	): boolean {
		const spread_value = normalize_initializer(item.expression);
		if (!ts.isArrayLiteralExpression(spread_value)) {
			return false;
		}
		const [spread_item] = spread_value.elements;
		if (spread_item === undefined) {
			return false;
		}
		return append_binding_alias(element.name, spread_item);
	}

	/** Responsibilities: _array binding item_. **/
	private append_array_item(
		element: ts.ArrayBindingElement,
		item: ts.Expression,
		append_binding_alias: (binding: ts.BindingName, initializer: ts.Expression) => boolean,
		normalize_initializer: (expression: ts.Expression) => ts.Expression
	): boolean {
		if (!ts.isBindingElement(element)) {
			return false;
		}
		if (element.dotDotDotToken || item.kind === ts.SyntaxKind.OmittedExpression) {
			return false;
		}
		if (ts.isSpreadElement(item)) {
			return this.spread_binding_item(element, item, append_binding_alias, normalize_initializer);
		}
		return append_binding_alias(element.name, item);
	}

	/** Responsibilities: _array binding aliases_. **/
	private append_array_aliases(
		binding: ts.ArrayBindingPattern,
		initializer: ts.ArrayLiteralExpression,
		append_binding_alias: (binding: ts.BindingName, initializer: ts.Expression) => boolean,
		normalize_initializer: (expression: ts.Expression) => ts.Expression
	): boolean {
		let changed = false;
		for (let index = 0; index < binding.elements.length; index += 1) {
			const element = binding.elements[index];
			const item = initializer.elements[index];
			if (element === undefined || item === undefined) {
				continue;
			}
			if (this.append_array_item(element, item, append_binding_alias, normalize_initializer)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _destructured alias resolution_. **/
	private append_destructured_alias(
		binding: ts.BindingName,
		value: ts.Expression,
		append_binding_alias: (binding: ts.BindingName, initializer: ts.Expression) => boolean,
		normalize_initializer: (expression: ts.Expression) => ts.Expression
	): boolean {
		if (ts.isObjectBindingPattern(binding)) {
			if (!ts.isObjectLiteralExpression(value)) {
				return false;
			}
			return this.append_object_aliases(binding, value, append_binding_alias, normalize_initializer);
		}
		if (ts.isArrayBindingPattern(binding)) {
			if (!ts.isArrayLiteralExpression(value)) {
				return false;
			}
			return this.append_array_aliases(binding, value, append_binding_alias, normalize_initializer);
		}
		return false;
	}

	/** Responsibilities: _cached property name_. **/
	public property_name(element: ts.Node): string {
		const cached = this.property_names.get(element);
		if (cached !== undefined) {
			return cached;
		}
		const property_name = this.resolve_property_name(element);
		this.property_names.set(element, property_name);
		return property_name;
	}

	/** Responsibilities: _binding alias collection_. **/
	public append_binding_aliases(
		aliases: Set<string>,
		binding: ts.BindingName,
		initializer: ts.Expression,
		normalize_initializer: (expression: ts.Expression) => ts.Expression,
		append_alias: (aliases: Set<string>, name: string, initializer: ts.Expression) => boolean
	): boolean {
		const value = normalize_initializer(initializer);
		if (ts.isIdentifier(binding)) {
			return append_alias(aliases, binding.text, value);
		}
		const append_binding_alias = (child_binding: ts.BindingName, child_initializer: ts.Expression): boolean =>
			this.append_binding_aliases(aliases, child_binding, child_initializer, normalize_initializer, append_alias);
		return this.append_destructured_alias(binding, value, append_binding_alias, normalize_initializer);
	}
}
