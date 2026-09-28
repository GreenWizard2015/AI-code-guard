import ts from 'typescript';
import { static_binding_name, static_property_name, unwrap_transparent_expression } from 'functions';

/** Responsibilities: _array object factory resolution_. **/
export class TypeScriptFactoryArrayObjectExpressions {
	private readonly initializer: ts.ObjectLiteralExpression;
	private readonly name: string;
	private readonly nested_expressions: (
		binding: ts.ArrayBindingPattern,
		initializer: ts.Expression,
		name: string,
	) => ReadonlyMap<string, ts.FunctionLikeDeclarationBase>;
	private readonly append_object_source: (
		expression: ts.Expression,
		visitor: (source: ts.ObjectLiteralExpression) => void,
	) => void;
	private readonly collected = new Map<string, ts.FunctionLikeDeclarationBase>();

	/** Responsibilities: _object property factory_. **/
	private append_direct_property(source: ts.Expression, element: ts.BindingElement): void {
		if (!ts.isIdentifier(element.name)) {
			return;
		}
		if (element.name.text === this.name && (ts.isArrowFunction(source) || ts.isFunctionExpression(source))) {
			this.collected.set(this.name, source);
		}
	}

	/** Responsibilities: _object property factory_. **/
	private append_nested_property(source: ts.Expression, element: ts.BindingElement): void {
		if (ts.isArrayBindingPattern(element.name)) {
			this.append_array_property(source, element.name);
			return;
		}
		if (!ts.isObjectBindingPattern(element.name)) {
			return;
		}
		this.append_source(source, element.name);
	}

	/** Responsibilities: _object property factory_. **/
	private append_property(property: ts.PropertyAssignment, element: ts.BindingElement): void {
		const source = unwrap_transparent_expression(property.initializer);
		if (ts.isIdentifier(element.name)) {
			this.append_direct_property(source, element);
			return;
		}
		this.append_nested_property(source, element);
	}

	/** Responsibilities: _nested array factory_. **/
	private append_array_property(source: ts.Expression, binding: ts.ArrayBindingPattern): void {
		for (const expression of this.nested_expressions(binding, source, this.name).values()) {
			this.collected.set(this.name, expression);
		}
	}

	/** Responsibilities: _nested object source_. **/
	private append_source(source: ts.Expression, binding: ts.ObjectBindingPattern): void {
		this.append_object_source(source, (object_source) => {
			const resolver = new TypeScriptFactoryArrayObjectExpressions(
				object_source,
				this.name,
				this.append_object_source,
				this.nested_expressions,
			);
			const nested = resolver.expressions(binding);
			for (const expression of nested.values()) {
				this.collected.set(this.name, expression);
			}
		});
	}

	/** Responsibilities: _object binding element_. **/
	private append_element(element: ts.BindingElement): void {
		const property_name = static_binding_name(element);
		for (let index = this.initializer.properties.length - 1; index >= 0; index -= 1) {
			const property = this.initializer.properties[index];
			if (property.name === undefined || static_property_name(property.name) !== property_name) {
				continue;
			}
			if (ts.isPropertyAssignment(property)) {
				this.append_property(property, element);
			}
			return;
		}
	}

	/** Responsibilities: _resolver state_. **/
	public constructor(
		initializer: ts.ObjectLiteralExpression,
		name: string,
		append_object_source: (
			expression: ts.Expression,
			visitor: (source: ts.ObjectLiteralExpression) => void,
		) => void,
		nested_expressions: (
			binding: ts.ArrayBindingPattern,
			initializer: ts.Expression,
			name: string,
		) => ReadonlyMap<string, ts.FunctionLikeDeclarationBase>,
	) {
		this.initializer = initializer;
		this.name = name;
		this.append_object_source = append_object_source;
		this.nested_expressions = nested_expressions;
	}

	/** Responsibilities: _object binding collection_. **/
	public append(binding: ts.ObjectBindingPattern): void {
		for (const element of binding.elements) {
			if (ts.isBindingElement(element)) {
				this.append_element(element);
			}
		}
	}

	/** Responsibilities: _object factory expressions_. **/
	public expressions(binding: ts.ObjectBindingPattern): ReadonlyMap<string, ts.FunctionLikeDeclarationBase> {
		this.append(binding);
		return this.collected;
	}
}
