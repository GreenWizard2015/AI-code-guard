import type {
	TypeScriptFactoryNestedObjectExpressionWalkContract,
	TypeScriptFactoryNestedObjectExpressionWalkOptions,
} from "src/contracts/protocols/lint_runtime_protocols";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type {
	TypeScriptFactoryArrayAliasesContract,
	TypeScriptFactoryObjectPropertiesContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _one binding traversal_, _factory expression ownership_. **/
export class TypeScriptFactoryNestedObjectExpressionWalk
	implements TypeScriptFactoryNestedObjectExpressionWalkContract
{
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _initializer: ts.ObjectLiteralExpression;
	private readonly _binding: ts.ObjectBindingPattern;
	private readonly _name: string;
	private readonly _collected_expressions: Map<string, ts.FunctionLikeDeclarationBase>;
	private readonly _object_sources: Map<string, ts.ObjectLiteralExpression>;
	private readonly _properties: TypeScriptFactoryObjectPropertiesContract;
	private readonly _array_aliases: TypeScriptFactoryArrayAliasesContract;

	/** Responsibilities: _nested binding source traversal_. **/
	private append_nested_source(source: ts.ObjectLiteralExpression, binding: ts.ObjectBindingPattern): void {
		const options: TypeScriptFactoryNestedObjectExpressionWalkOptions = {
			initializer: source,
			binding,
			name: this._name,
			expressions: this._collected_expressions,
			object_sources: this._object_sources,
			properties: this._properties,
			array_aliases: this._array_aliases,
		};
		const walk = new TypeScriptFactoryNestedObjectExpressionWalk(options);
		walk.append();
	}

	/** Responsibilities: _nested object value resolution_. **/
	private append_nested_value(value: ts.Expression, binding: ts.ObjectBindingPattern): void {
		const source = this._expression_names.unwrap_transparent_expression(value);
		let nested_source: ts.ObjectLiteralExpression;
		if (ts.isObjectLiteralExpression(source)) {
			nested_source = source;
		} else {
			if (!ts.isIdentifier(source)) {
				return;
			}
			const aliased_source = this._object_sources.get(source.text);
			if (aliased_source === undefined) {
				return;
			}
			nested_source = aliased_source;
		}
		this.append_nested_source(nested_source, binding);
	}

	/** Responsibilities: _spread property resolution_. **/
	private append_spread_assignment(
		spread: ts.SpreadAssignment,
		property_name: string,
		spread_binding: ts.ObjectBindingPattern,
	): void {
		let source = this._expression_names.unwrap_transparent_expression(spread.expression);
		if (ts.isIdentifier(source)) {
			const aliased_source = this._object_sources.get(source.text);
			if (aliased_source === undefined) {
				return;
			}
			source = aliased_source;
		}
		if (!ts.isObjectLiteralExpression(source)) {
			return;
		}
		for (const property of source.properties) {
			if (this._properties.property_key(property) === property_name && ts.isPropertyAssignment(property)) {
				this.append_nested_value(property.initializer, spread_binding);
			}
		}
	}

	/** Responsibilities: _array binding expression collection_. **/
	private append_array_binding(array_element: ts.BindingElement): void {
		if (!ts.isArrayBindingPattern(array_element.name)) {
			return;
		}
		const property_name = this._expression_names.static_binding_name(array_element);
		for (const property of this._initializer.properties) {
			if (this._properties.property_key(property) !== property_name || !ts.isPropertyAssignment(property)) {
				continue;
			}
			const source = this._expression_names.unwrap_transparent_expression(property.initializer);
			const aliases = this._array_aliases.alias(this._name).nested_expressions(array_element.name, source);
			for (const expression of aliases.values()) {
				this._collected_expressions.set(this._name, expression);
			}
		}
	}

	/** Responsibilities: _object binding expression collection_. **/
	private append_object_element(element: ts.BindingElement): void {
		if (!ts.isObjectBindingPattern(element.name)) {
			return;
		}
		const property_name = this._expression_names.static_binding_name(element);
		for (let index = this._initializer.properties.length - 1; index >= 0; index -= 1) {
			const property = this._initializer.properties[index];
			if (property === undefined) {
				continue;
			}
			if (this.append_object_property(property, property_name, element.name)) {
				return;
			}
		}
	}

	/** Responsibilities: _object property value collection_. **/
	private append_object_property(
		property: ts.ObjectLiteralElementLike,
		property_name: string,
		object_binding: ts.ObjectBindingPattern,
	): boolean {
		if (ts.isSpreadAssignment(property)) {
			this.append_spread_assignment(property, property_name, object_binding);
			return false;
		}
		if (this._properties.property_key(property) !== property_name) {
			return false;
		}
		if (ts.isPropertyAssignment(property)) {
			this.append_nested_value(property.initializer, object_binding);
		}
		return true;
	}

	/** Responsibilities: _binding element expression collection_. **/
	private append_element(element: ts.BindingElement): void {
		if (ts.isIdentifier(element.name)) {
			if (element.name.text !== this._name) {
				return;
			}
			const property_name = this._expression_names.static_binding_name(element);
			const property_context = this._properties.property_context(this._initializer, property_name);
			for (const expression of property_context.expressions().values()) {
				this._collected_expressions.set(this._name, expression);
			}
			return;
		}
		if (ts.isArrayBindingPattern(element.name)) {
			this.append_array_binding(element);
			return;
		}
		this.append_object_element(element);
	}

	/** Responsibilities: _binding traversal initialization_. **/
	public constructor(options: TypeScriptFactoryNestedObjectExpressionWalkOptions) {
		this._expression_names = new TypeScriptExpressionNames();
		this._initializer = options.initializer;
		this._binding = options.binding;
		this._name = options.name;
		this._collected_expressions = options.expressions;
		this._object_sources = options.object_sources;
		this._properties = options.properties;
		this._array_aliases = options.array_aliases;
	}

	/** Responsibilities: _expression results_. **/
	public expressions(): ReadonlyMap<string, ts.FunctionLikeDeclarationBase> {
		this.append();
		return this._collected_expressions;
	}

	/** Responsibilities: _binding expression collection_. **/
	public append(): void {
		for (const element of this._binding.elements) {
			if (ts.isBindingElement(element)) {
				this.append_element(element);
			}
		}
	}
}
