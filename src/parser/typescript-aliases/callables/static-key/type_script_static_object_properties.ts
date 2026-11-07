import { TypeScriptStaticObjectSources } from "src/parser/typescript-aliases/callables/type_script_static_object_sources";
import { TypeScriptStaticObjectValues } from "src/parser/typescript-aliases/callables/type_script_static_object_values";
import type {
	ResolvedStaticBindingQuery,
	StaticArrayBindingElementQuery,
	StaticArrayBindingSourceQuery,
	StaticArrayPropertiesQuery,
	StaticNamedObjectPropertyQuery,
	StaticNestedObjectPropertyQuery,
	StaticObjectBindingContext,
	StaticObjectBindingQuery,
	StaticObjectBindingSourceQuery,
	StaticObjectPropertiesQuery,
} from "src/parser/typescript-aliases/protocols";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import type {
	TypeScriptStaticObjectSourcesContract,
	TypeScriptStaticObjectValuesContract,
} from "src/typescript_analysis_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _object property binding_, _nested destructuring resolution_. **/
export class TypeScriptStaticObjectProperties {
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly _source_expressions: TypeScriptStaticObjectSourcesContract;
	private readonly _value_resolver: TypeScriptStaticObjectValuesContract;
	private readonly _context: StaticObjectBindingContext;

	/** Responsibilities: _array binding value collection_. **/
	private append_array_elements(query: StaticArrayPropertiesQuery): boolean {
		let changed = false;
		for (const [index, element] of query.binding.elements.entries()) {
			const value = query.initializer.elements[index];
			if (value === undefined) {
				continue;
			}
			if (!ts.isBindingElement(element)) {
				continue;
			}
			if (this.append_array_element({ element, value })) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _array binding element resolution_. **/
	private append_array_element(query: StaticArrayBindingElementQuery): boolean {
		if (!ts.isIdentifier(query.element.name)) {
			return this.append_binding({ binding: query.element.name, initializer: query.value });
		}
		if (this._value_resolver.append_object(query.element.name.text, query.value)) {
			return true;
		}
		const value = this._expression_aliases.unwrapped(query.value);
		return this._value_resolver.append_value(query.element.name.text, value);
	}

	/** Responsibilities: _named object property binding_. **/
	private append_named_property(query: StaticNamedObjectPropertyQuery): boolean {
		return this._value_resolver.append_property_value(
			query.initializer,
			query.source_name,
			new Set<ts.ObjectLiteralExpression>(),
			(current) => {
				const value = this._expression_aliases.unwrapped(current);
				return this._value_resolver.append_value(query.target_name, value);
			},
		);
	}

	/** Responsibilities: _nested object property binding_. **/
	private append_nested_property(query: StaticNestedObjectPropertyQuery): boolean {
		const target = query.target;
		const visited = new Set<ts.ObjectLiteralExpression>();
		return this._value_resolver.append_property_value(query.initializer, query.source_name, visited, (current) =>
			this.append_binding({ binding: target, initializer: current }),
		);
	}

	/** Responsibilities: _object binding source resolution_. **/
	private append_object_binding(query: StaticObjectBindingSourceQuery): boolean {
		if (ts.isObjectLiteralExpression(query.current)) {
			return this.append_properties({ binding: query.binding, initializer: query.current });
		}
		if (!ts.isIdentifier(query.current)) {
			return false;
		}
		const object = this._context.objects.get(query.current.text);
		return object !== undefined && this.append_properties({ binding: query.binding, initializer: object });
	}

	/** Responsibilities: _array binding source resolution_. **/
	private append_array_binding(query: StaticArrayBindingSourceQuery): boolean {
		if (!ts.isArrayLiteralExpression(query.current)) {
			return false;
		}
		return this.append_array_elements({ binding: query.binding, initializer: query.current });
	}

	/** Responsibilities: _binding source resolution_. **/
	private append_resolved_binding(query: ResolvedStaticBindingQuery): boolean {
		if (ts.isIdentifier(query.binding)) {
			return this._value_resolver.append_object(query.binding.text, query.current);
		}
		if (ts.isObjectBindingPattern(query.binding)) {
			return this.append_object_binding({ binding: query.binding, current: query.current });
		}
		if (ts.isArrayBindingPattern(query.binding)) {
			return this.append_array_binding({ binding: query.binding, current: query.current });
		}
		return false;
	}

	/** Responsibilities: _object property source-name resolution_. **/
	private property_source_name(element: ts.BindingElement): string {
		if (element.propertyName !== undefined) {
			return this._value_resolver.property_name(element.propertyName);
		}
		return this._value_resolver.property_name(element.name);
	}

	/** Responsibilities: _object property binding dispatch_. **/
	private append_property(element: ts.BindingElement, initializer: ts.ObjectLiteralExpression): boolean {
		if (ts.isIdentifier(element.name)) {
			if (element.dotDotDotToken) {
				return this._value_resolver.append_object(element.name.text, initializer);
			}
			return this.append_named_property({
				initializer,
				source_name: this.property_source_name(element),
				target_name: element.name.text,
			});
		}
		if (element.propertyName === undefined) {
			return false;
		}
		return this.append_nested_property({
			initializer,
			source_name: this._value_resolver.property_name(element.propertyName),
			target: element.name,
		});
	}

	/** Responsibilities: _object binding resolution initialization_. **/
	public constructor(context: StaticObjectBindingContext) {
		this._expression_aliases = new TypeScriptExpressionAliases("", context.declaration_index);
		this._value_resolver = new TypeScriptStaticObjectValues(context.values, context.objects);
		this._context = context;
		this._source_expressions = new TypeScriptStaticObjectSources(context.arguments_source, context.declaration_index);
	}

	/** Responsibilities: _object property binding collection_. **/
	public append_properties(query: StaticObjectPropertiesQuery): boolean {
		let changed = false;
		for (const element of query.binding.elements) {
			if (this.append_property(element, query.initializer)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _nested binding source resolution_. **/
	public append_binding(query: StaticObjectBindingQuery): boolean {
		const current = this._expression_aliases.unwrapped(query.initializer);
		const found_source = this._source_expressions.append_binding(current, (expression) =>
			this.append_binding({ binding: query.binding, initializer: expression }),
		);
		if (found_source) {
			return true;
		}
		return this.append_resolved_binding({ binding: query.binding, current });
	}
}
