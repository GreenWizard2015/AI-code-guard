import ts from 'typescript';
import { TypeScriptNamespaceAliases } from 'src/bridge/ts/runner/orchestration/runtime/typescript-singleton/namespace-aliases';
import { static_binding_name, static_property_name, unwrap_transparent_expression } from 'functions';

/** Responsibilities: _resolution destructured class aliases_. **/
export class TypeScriptDestructuredAliases {
	private readonly names: Set<string>;
	private readonly object_sources = new Map<string, ts.ObjectLiteralExpression>();
	private readonly namespace_aliases: TypeScriptNamespaceAliases;

	/** Responsibilities: _collection class alias name_. **/
	private append_name_alias(name: string, target: string): boolean {
		if (target === '') {
			return false;
		}
		if (!this.names.has(target)) {
			return false;
		}
		if (this.names.has(name)) {
			return false;
		}
		this.names.add(name);
		return true;
	}

	/** Responsibilities: _resolution object property target_. **/
	private direct_property_target(
		property: ts.ObjectLiteralElementLike,
		property_name: string
	): string {
		if (!property.name || static_property_name(property.name) !== property_name) {
			return '';
		}
		if (ts.isShorthandPropertyAssignment(property)) {
			return property.name.text;
		}
		if (!ts.isPropertyAssignment(property)) {
			return '';
		}
		return this.property_value_target(property.initializer);
	}

	/** Responsibilities: _resolution property value alias_. **/
	private property_value_target(initializer: ts.Expression): string {
		const value = unwrap_transparent_expression(initializer);
		if (ts.isIdentifier(value)) {
			return value.text;
		}
		return this.namespace_aliases.target(value);
	}

	/** Responsibilities: _resolution object property source_. **/
	private property_target(
		property: ts.ObjectLiteralElementLike,
		property_name: string
	): string {
		if (ts.isSpreadAssignment(property)) {
			return this.spread_property_target(property.expression, property_name);
		}
		return this.direct_property_target(property, property_name);
	}

	/** Responsibilities: _resolution spread property target_. **/
	private spread_property_target(expression: ts.Expression, property_name: string): string {
		let source = unwrap_transparent_expression(expression);
		if (ts.isIdentifier(source)) {
			const alias = this.object_sources.get(source.text);
			if (alias === undefined) {
				return '';
			}
			source = alias;
		}
		if (!ts.isObjectLiteralExpression(source)) {
			return '';
		}
		return this.object_property_target(source, property_name);
	}

	/** Responsibilities: _resolution object property target_. **/
	private object_property_target(
		initializer: ts.ObjectLiteralExpression,
		property_name: string
	): string {
		for (let index = initializer.properties.length - 1; index >= 0; index -= 1) {
			const property = initializer.properties[index];
			const target = this.property_target(property, property_name);
			if (target !== '') {
				return target;
			}
		}
		return '';
	}

	/** Responsibilities: _resolution binding property name_. **/
	private binding_property_name(element: ts.BindingElement): string {
		if (!ts.isIdentifier(element.name)) {
			return '';
		}
		return static_binding_name(element);
	}

	/** Responsibilities: _collection object alias binding_. **/
	private append_object_alias(
		initializer: ts.ObjectLiteralExpression,
		element: ts.BindingElement
	): boolean {
		const property_name = this.binding_property_name(element);
		if (property_name === '') {
			return false;
		}
		if (!ts.isIdentifier(element.name)) {
			return false;
		}
		let target = this.object_property_target(initializer, property_name);
		if (target === '' && element.initializer !== undefined) {
			target = this.property_value_target(element.initializer);
		}
		return this.append_name_alias(element.name.text, target);
	}

	/** Responsibilities: _collection object binding aliases_. **/
	private append_object_elements(
		initializer: ts.ObjectLiteralExpression,
		elements: readonly ts.BindingElement[],
	): boolean {
		let changed = false;
		for (const element of elements) {
			if (this.append_object_alias(initializer, element)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _collection object source aliases_. **/
	private append_object_source(
		declaration: ts.VariableDeclaration,
		elements: readonly ts.BindingElement[],
	): boolean {
		if (declaration.initializer === undefined) {
			return false;
		}
		let initializer = unwrap_transparent_expression(declaration.initializer);
		if (ts.isIdentifier(initializer)) {
			const source = this.object_sources.get(initializer.text);
			if (source === undefined) {
				return false;
			}
			initializer = source;
		}
		if (!ts.isObjectLiteralExpression(initializer)) {
			return false;
		}
		return this.append_object_elements(initializer, elements);
	}

	/** Responsibilities: _collection object source registration_. **/
	private register_object_source(declaration: ts.VariableDeclaration): void {
		if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) {
			return;
		}
		let initializer = unwrap_transparent_expression(declaration.initializer);
		if (ts.isIdentifier(initializer)) {
			const source = this.object_sources.get(initializer.text);
			if (source === undefined) {
				return;
			}
			initializer = source;
		}
		if (ts.isObjectLiteralExpression(initializer)) {
			this.object_sources.set(declaration.name.text, initializer);
		}
	}

	/** Responsibilities: _initialization destructured alias names_. **/
	public constructor(names: Set<string>, source_file: ts.SourceFile) {
		this.names = names;
		this.namespace_aliases = new TypeScriptNamespaceAliases(source_file);
	}

	/** Responsibilities: _collection destructured alias sources_. **/
	public register_sources(declarations: readonly ts.VariableDeclaration[]): void {
		for (const declaration of declarations) {
			this.register_object_source(declaration);
		}
	}

	/** Responsibilities: _collection object destructured aliases_. **/
	public object_aliases(declaration: ts.VariableDeclaration): boolean {
		if (!ts.isObjectBindingPattern(declaration.name)) {
			return false;
		}
		return this.append_object_source(declaration, declaration.name.elements);
	}
}
