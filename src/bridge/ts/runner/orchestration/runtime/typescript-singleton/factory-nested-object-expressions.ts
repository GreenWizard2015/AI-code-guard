import ts from "typescript";
import type { TypeScriptFactoryArrayAliasesProtocol, TypeScriptFactoryObjectPropertiesProtocol } from "src/protocols";
import { TypeScriptExpressionNames } from "src/typescript-aliases/typescript-expression-names";

/** Responsibilities: _resolution nested object expressions_. **/
export class TypeScriptFactoryNestedObjectExpressions {
	private readonly expression_names = new TypeScriptExpressionNames();
	private readonly object_sources: Map<string, ts.ObjectLiteralExpression>;
	private readonly properties: TypeScriptFactoryObjectPropertiesProtocol;
	private readonly array_aliases: TypeScriptFactoryArrayAliasesProtocol;

	/** Responsibilities: _nested property value_. **/
	private append_value(
		value: ts.Expression,
		binding: ts.ObjectBindingPattern,
		name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void {
		const source = this.expression_names.unwrap_transparent_expression(value);
		if (ts.isObjectLiteralExpression(source)) {
			this.append(source, binding, name, expressions);
		}
		if (ts.isIdentifier(source)) {
			const object_source = this.object_sources.get(source.text);
			if (object_source !== undefined) {
				this.append(object_source, binding, name, expressions);
			}
		}
	}

	/** Responsibilities: _nested array property_. **/
	private append_array_property(
		initializer: ts.ObjectLiteralExpression,
		property_name: string,
		binding: ts.ArrayBindingPattern,
		name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void {
		for (const property of initializer.properties) {
			if (this.properties.property_key(property) !== property_name || !ts.isPropertyAssignment(property)) {
				continue;
			}
			const source = this.expression_names.unwrap_transparent_expression(property.initializer);
			for (const expression of this.array_aliases.nested_expressions(binding, source, name).values()) {
				expressions.set(name, expression);
			}
		}
	}

	/** Responsibilities: _nested spread value_. **/
	private append_spread(
		expression: ts.Expression,
		property_name: string,
		binding: ts.ObjectBindingPattern,
		name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void {
		let source = this.expression_names.unwrap_transparent_expression(expression);
		if (ts.isIdentifier(source)) {
			const object_source = this.object_sources.get(source.text);
			if (object_source === undefined) {
				return;
			}
			source = object_source;
		}
		if (!ts.isObjectLiteralExpression(source)) {
			return;
		}
		for (const property of source.properties) {
			if (this.properties.property_key(property) !== property_name || !ts.isPropertyAssignment(property)) {
				continue;
			}
			this.append_value(property.initializer, binding, name, expressions);
		}
	}

	/** Responsibilities: _nested property expression_. **/
	private append_element(
		initializer: ts.ObjectLiteralExpression,
		element: ts.BindingElement,
		name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void {
		if (ts.isIdentifier(element.name)) {
			this.append_leaf(initializer, element, name, expressions);
			return;
		}
		this.append_nested_element(initializer, element, name, expressions);
	}

	/** Responsibilities: _nested binding element_. **/
	private append_nested_element(
		initializer: ts.ObjectLiteralExpression,
		element: ts.BindingElement,
		name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void {
		if (ts.isArrayBindingPattern(element.name)) {
			const property_name = this.expression_names.static_binding_name(element);
			if (property_name !== "") {
				this.append_array_property(initializer, property_name, element.name, name, expressions);
			}
			return;
		}
		if (!ts.isObjectBindingPattern(element.name)) {
			return;
		}
		const property_name = this.expression_names.static_binding_name(element);
		if (property_name === "") {
			return;
		}
		this.append_nested_properties(initializer, element.name, property_name, name, expressions);
	}

	/** Responsibilities: _nested property expressions_. **/
	private append_nested_properties(
		initializer: ts.ObjectLiteralExpression,
		binding: ts.ObjectBindingPattern,
		property_name: string,
		name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void {
		for (let index = initializer.properties.length - 1; index >= 0; index -= 1) {
			const property = initializer.properties[index];
			if (ts.isSpreadAssignment(property)) {
				this.append_spread(property.expression, property_name, binding, name, expressions);
				continue;
			}
			if (this.append_direct_property(property, property_name, binding, name, expressions)) {
				return;
			}
		}
	}

	/** Responsibilities: _nested leaf expression_. **/
	private append_leaf(
		initializer: ts.ObjectLiteralExpression,
		element: ts.BindingElement,
		name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void {
		if (!ts.isIdentifier(element.name) || element.name.text !== name) {
			return;
		}
		for (const expression of this.properties
			.expressions(initializer, this.expression_names.static_binding_name(element))
			.values()) {
			expressions.set(name, expression);
		}
	}

	/** Responsibilities: _direct nested property_. **/
	private append_direct_property(
		property: ts.ObjectLiteralElementLike,
		property_name: string,
		binding: ts.ObjectBindingPattern,
		name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): boolean {
		if (this.properties.property_key(property) !== property_name || !ts.isPropertyAssignment(property)) {
			return false;
		}
		this.append_value(property.initializer, binding, name, expressions);
		return true;
	}

	/** Responsibilities: _initialization nested object expressions_. **/
	public constructor(
		object_sources: Map<string, ts.ObjectLiteralExpression>,
		properties: TypeScriptFactoryObjectPropertiesProtocol,
		array_aliases: TypeScriptFactoryArrayAliasesProtocol,
	) {
		this.object_sources = object_sources;
		this.properties = properties;
		this.array_aliases = array_aliases;
	}

	/** Responsibilities: _nested object expression sources_. **/
	public expressions(
		initializer: ts.ObjectLiteralExpression,
		binding: ts.ObjectBindingPattern,
		name: string,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase> {
		const expressions = new Map<string, ts.FunctionLikeDeclarationBase>();
		this.append(initializer, binding, name, expressions);
		return expressions;
	}

	/** Responsibilities: _nested expression collection_. **/
	public append(
		initializer: ts.ObjectLiteralExpression,
		binding: ts.ObjectBindingPattern,
		name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void {
		for (const element of binding.elements) {
			if (ts.isBindingElement(element)) {
				this.append_element(initializer, element, name, expressions);
			}
		}
	}
}
