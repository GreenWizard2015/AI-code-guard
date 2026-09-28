import ts from 'typescript';
import type { FactoryObjectSourcesContract } from 'src/bridge/ts/runner/orchestration/runtime/protocols';
import { static_binding_name, static_property_name } from 'functions';

/** Responsibilities: _factory object binding sources_. **/
export class TypeScriptFactoryObjectBindingSources {
	private readonly object_sources: FactoryObjectSourcesContract;

	/** Responsibilities: _direct binding source_. **/
	private direct_binding_source(
		initializer: ts.ObjectLiteralExpression,
		binding: ts.ObjectBindingPattern,
		name: string,
	): string {
		for (const element of binding.elements) {
			if (!ts.isBindingElement(element)) {
				continue;
			}
			if (!ts.isIdentifier(element.name)) {
				continue;
			}
			if (element.name.text !== name) {
				continue;
			}
			return this.property_source(initializer, static_binding_name(element));
		}
		return '';
	}

	/** Responsibilities: _nested binding source_. **/
	private nested_binding_source(
		initializer: ts.ObjectLiteralExpression,
		element: ts.BindingElement,
		name: string,
		array_source: (binding: ts.ArrayBindingPattern, value: ts.Expression, name: string) => string,
	): string {
		let result = '';
		this.append_property_value(initializer, static_binding_name(element), (value) => {
			if (ts.isObjectBindingPattern(element.name)) {
				const binding = element.name;
				this.object_sources.append(value, (source) => {
					result = this.source(source, binding, name, array_source);
				});
				return;
			}
			if (ts.isArrayBindingPattern(element.name)) {
				result = array_source(element.name, value, name);
			}
		});
		return result;
	}

	/** Responsibilities: _source property lookup_. **/
	private source_property(property: ts.ObjectLiteralElementLike, property_name: string): string {
		if (ts.isSpreadAssignment(property)) {
			return this.spread_source(property.expression, property_name);
		}
		if (property.name === undefined || static_property_name(property.name) !== property_name) {
			return '';
		}
		if (ts.isShorthandPropertyAssignment(property)) {
			return property.name.text;
		}
		if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.initializer)) {
			return property.initializer.text;
		}
		return '';
	}

	/** Responsibilities: _direct property value_. **/
	private direct_property(
		property: ts.ObjectLiteralElementLike,
		property_name: string,
		visitor: (value: ts.Expression) => void,
	): boolean {
		if (property.name === undefined) {
			return false;
		}
		if (static_property_name(property.name) !== property_name) {
			return false;
		}
		if (!ts.isPropertyAssignment(property)) {
			return false;
		}
		visitor(property.initializer);
		return true;
	}

	/** Responsibilities: _object property value_. **/
	private append_property_value(
		initializer: ts.ObjectLiteralExpression,
		property_name: string,
		visitor: (value: ts.Expression) => void,
	): void {
		for (let index = initializer.properties.length - 1; index >= 0; index -= 1) {
			const property = initializer.properties[index];
			if (ts.isSpreadAssignment(property)) {
				this.object_sources.append(property.expression, (source) => {
					this.append_property_value(source, property_name, visitor);
				});
				continue;
			}
			if (this.direct_property(property, property_name, visitor)) {
				return;
			}
		}
	}

	/** Responsibilities: _spread property source_. **/
	private spread_source(expression: ts.Expression, property_name: string): string {
		let result = '';
		this.object_sources.append(expression, (initializer) => {
			result = this.property_source(initializer, property_name);
		});
		return result;
	}

	/** Responsibilities: _resolver state_. **/
	public constructor(object_sources: FactoryObjectSourcesContract) {
		this.object_sources = object_sources;
	}

	/** Responsibilities: _object property source_. **/
	public property_source(initializer: ts.ObjectLiteralExpression, property_name: string): string {
		for (let index = initializer.properties.length - 1; index >= 0; index -= 1) {
			const source = this.source_property(initializer.properties[index], property_name);
			if (source !== '') {
				return source;
			}
		}
		return '';
	}

	/** Responsibilities: _object binding resolution_. **/
	public source(
		initializer: ts.ObjectLiteralExpression,
		binding: ts.ObjectBindingPattern,
		name: string,
		array_source: (binding: ts.ArrayBindingPattern, value: ts.Expression, name: string) => string,
	): string {
		const direct = this.direct_binding_source(initializer, binding, name);
		if (direct !== '') {
			return direct;
		}
		for (const element of binding.elements) {
			if (!ts.isBindingElement(element)) {
				continue;
			}
			if (ts.isIdentifier(element.name)) {
				continue;
			}
			return this.nested_binding_source(initializer, element, name, array_source);
		}
		return '';
	}
}
