import type {
	FactoryObjectSourcesContract,
	TypeScriptFactoryArraySourcesContract,
} from "src/contracts/protocols/lint_runtime_protocols";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import ts from "typescript";

/** Responsibilities: _factory binding traversal_, _factory expression indexing_. **/
export class TypeScriptFactoryArrayBindingTraversal {
	private readonly _name: string;
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _sources: TypeScriptFactoryArraySourcesContract;
	private readonly _object_sources: FactoryObjectSourcesContract;
	private readonly _expressions: Map<string, ts.FunctionLikeDeclarationBase>;

	/** Responsibilities: _array binding value traversal_. **/
	private append_array_values(elements: readonly ts.ArrayBindingElement[], values: readonly ts.Expression[]): void {
		for (let index = 0; index < elements.length; index += 1) {
			const element = elements[index];
			const value = values[index];
			if (element !== undefined && value !== undefined) {
				this.append_expression(element, value);
			}
		}
	}

	/** Responsibilities: _array binding source traversal_. **/
	private append_array_binding(element: ts.Node, array_value: ts.Expression): boolean {
		let binding: ts.ArrayBindingPattern;
		if (ts.isArrayBindingPattern(element)) {
			binding = element;
		} else if (ts.isBindingElement(element) && ts.isArrayBindingPattern(element.name)) {
			binding = element.name;
		} else {
			return false;
		}
		if (ts.isArrayLiteralExpression(array_value)) {
			this.append_array_values(binding.elements, this._sources.elements(array_value));
		}
		return true;
	}

	/** Responsibilities: _object binding source traversal_. **/
	private append_object_binding(element: ts.BindingElement, value: ts.Expression): void {
		if (!ts.isObjectBindingPattern(element.name)) {
			return;
		}
		const binding = element.name;
		this._object_sources.append(value, (initializer) => this.append_object_elements(initializer, binding));
	}

	/** Responsibilities: _object binding elements_. **/
	private append_object_elements(initializer: ts.ObjectLiteralExpression, binding: ts.ObjectBindingPattern): void {
		for (const element of binding.elements) {
			if (ts.isBindingElement(element)) {
				this.append_object_element(initializer, element);
			}
		}
	}

	/** Responsibilities: _object binding element_. **/
	private append_object_element(initializer: ts.ObjectLiteralExpression, element: ts.BindingElement): void {
		const property_name = this._expression_names.static_binding_name(element);
		for (let index = initializer.properties.length - 1; index >= 0; index -= 1) {
			const property = initializer.properties[index];
			if (property === undefined || property.name === undefined) {
				continue;
			}
			if (this._expression_names.static_property_name(property.name) !== property_name) {
				continue;
			}
			if (ts.isPropertyAssignment(property)) {
				const source = this._expression_names.unwrap_transparent_expression(property.initializer);
				this.append_binding_source(element.name, source);
			}
			return;
		}
	}

	/** Responsibilities: _nested binding source expansion_. **/
	private append_binding_source(binding_name: ts.BindingName, binding_source: ts.Expression): void {
		if (ts.isIdentifier(binding_name)) {
			this.append_named_binding(binding_name, binding_source);
			return;
		}
		if (ts.isArrayBindingPattern(binding_name)) {
			this.append_nested_array(binding_name, binding_source);
			return;
		}
		if (ts.isObjectBindingPattern(binding_name)) {
			const binding = binding_name;
			this._object_sources.append(binding_source, (initializer) => this.append_object_elements(initializer, binding));
		}
	}

	/** Responsibilities: _named factory binding registration_. **/
	private append_named_binding(binding_name: ts.Identifier, binding_value: ts.Expression): void {
		if (binding_name.text !== this._name) {
			return;
		}
		if (ts.isArrowFunction(binding_value) || ts.isFunctionExpression(binding_value)) {
			this._expressions.set(this._name, binding_value);
		}
	}

	/** Responsibilities: _nested factory array bindings_. **/
	private append_nested_array(pattern: ts.ArrayBindingPattern, initializer: ts.Expression): void {
		const traversal = new TypeScriptFactoryArrayBindingTraversal(
			this._name,
			this._expression_names,
			this._sources,
			this._object_sources,
		);
		const nested = traversal.nested_expressions(pattern, initializer);
		for (const expression of nested.values()) {
			this._expressions.set(this._name, expression);
		}
	}

	/** Responsibilities: _array binding expression traversal_. **/
	private append_expression(element: ts.Node, value: ts.Expression): void {
		const source = this._expression_names.unwrap_transparent_expression(value);
		if (this.append_array_binding(element, source)) {
			return;
		}
		if (!ts.isBindingElement(element)) {
			return;
		}
		if (ts.isObjectBindingPattern(element.name)) {
			this.append_object_binding(element, value);
			return;
		}
		if (!ts.isIdentifier(element.name) || element.name.text !== this._name) {
			return;
		}
		if (ts.isArrowFunction(source) || ts.isFunctionExpression(source)) {
			this._expressions.set(this._name, source);
		}
	}

	/** Responsibilities: _array binding traversal setup_. **/
	public constructor(
		name: string,
		expression_names: ExpressionNamesContract,
		sources: TypeScriptFactoryArraySourcesContract,
		object_sources: FactoryObjectSourcesContract,
	) {
		this._name = name;
		this._expression_names = expression_names;
		this._sources = sources;
		this._object_sources = object_sources;
		this._expressions = new Map<string, ts.FunctionLikeDeclarationBase>();
	}

	/** Responsibilities: _array factory binding traversal_. **/
	public binding_expressions(
		binding: ts.ArrayBindingPattern,
		values: readonly ts.Expression[],
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase> {
		for (let index = 0; index < binding.elements.length; index += 1) {
			const element = binding.elements[index];
			const value = values[index];
			if (element !== undefined && value !== undefined) {
				this.append_expression(element, value);
			}
		}
		return this._expressions;
	}

	/** Responsibilities: _nested factory binding traversal_. **/
	public nested_expressions(
		binding: ts.ArrayBindingPattern,
		initializer: ts.Expression,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase> {
		this._sources.append(initializer, (values) => {
			for (const [alias_name, expression] of this.binding_expressions(binding, values)) {
				this._expressions.set(alias_name, expression);
			}
		});
		return this._expressions;
	}
}
