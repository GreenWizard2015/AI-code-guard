import { TypeScriptNamespaceAliases } from "src/linting/orchestration/runtime/typescript-singleton/destructured-aliases/type_script_namespace_aliases";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { TypeScriptDestructuredAliasesContract } from "src/typescript_analysis_protocols";
import type { TypeScriptNamespaceAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _object binding alias resolution_, _class alias registration_. **/
export class TypeScriptDestructuredAliases implements TypeScriptDestructuredAliasesContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _names: Set<string>;
	private readonly _object_sources: Map<string, ts.ObjectLiteralExpression>;
	private readonly _namespace_aliases: TypeScriptNamespaceAliasesContract;

	/** Responsibilities: _collection class alias name_. **/
	private append_name_alias(name: string, target: string): boolean {
		if (target === "") {
			return false;
		}
		if (!this._names.has(target)) {
			return false;
		}
		if (this._names.has(name)) {
			return false;
		}
		this._names.add(name);
		return true;
	}

	/** Responsibilities: _resolution property value alias_. **/
	private property_value_target(initializer: ts.Expression): string {
		const value = this._expression_names.unwrap_transparent_expression(initializer);
		if (ts.isIdentifier(value)) {
			return value.text;
		}
		return this._namespace_aliases.target(value);
	}

	/** Responsibilities: _resolution object spread source_. **/
	private spread_source(expression: ts.Expression): ts.Expression {
		let source = this._expression_names.unwrap_transparent_expression(expression);
		if (ts.isIdentifier(source)) {
			const object_source = this._object_sources.get(source.text);
			if (object_source !== undefined) {
				source = object_source;
			}
		}
		return source;
	}

	/** Responsibilities: _object property target_. **/
	private property_target(property: ts.ObjectLiteralElementLike, property_name: string): string {
		if (ts.isSpreadAssignment(property)) {
			const source = this.spread_source(property.expression);
			if (!ts.isObjectLiteralExpression(source)) {
				return "";
			}
			return this.object_property_target(source, property_name);
		}
		if (!property.name || this._expression_names.static_property_name(property.name) !== property_name) {
			return "";
		}
		if (ts.isShorthandPropertyAssignment(property)) {
			return property.name.text;
		}
		if (ts.isPropertyAssignment(property)) {
			return this.property_value_target(property.initializer);
		}
		return "";
	}

	/** Responsibilities: _resolution object property target_. **/
	private object_property_target(initializer: ts.ObjectLiteralExpression, property_name: string): string {
		for (let index = initializer.properties.length - 1; index >= 0; index -= 1) {
			const property = initializer.properties[index];
			if (property === undefined) {
				continue;
			}
			const target = this.property_target(property, property_name);
			if (target !== "") {
				return target;
			}
		}
		return "";
	}

	/** Responsibilities: _resolution binding property name_. **/
	private binding_property_name(element: ts.BindingElement): string {
		if (!ts.isIdentifier(element.name)) {
			return "";
		}
		return this._expression_names.static_binding_name(element);
	}

	/** Responsibilities: _collection object alias binding_. **/
	private append_object_alias(element: ts.BindingElement, target: string): boolean {
		if (!ts.isIdentifier(element.name)) {
			return false;
		}
		let resolved_target = target;
		if (resolved_target === "" && element.initializer !== undefined) {
			resolved_target = this.property_value_target(element.initializer);
		}
		return this.append_name_alias(element.name.text, resolved_target);
	}

	/** Responsibilities: _collection object binding aliases_. **/
	private append_object_elements(
		initializer: ts.ObjectLiteralExpression,
		elements: readonly ts.BindingElement[],
	): boolean {
		let changed = false;
		for (const element of elements) {
			const property_name = this.binding_property_name(element);
			if (property_name === "") {
				continue;
			}
			const target = this.object_property_target(initializer, property_name);
			if (this.append_object_alias(element, target)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _collection object source aliases_. **/
	private append_object_source(initializer: ts.Expression, elements: readonly ts.BindingElement[]): boolean {
		let source_expression = this._expression_names.unwrap_transparent_expression(initializer);
		if (ts.isIdentifier(source_expression)) {
			const source = this._object_sources.get(source_expression.text);
			if (source === undefined) {
				return false;
			}
			source_expression = source;
		}
		if (!ts.isObjectLiteralExpression(source_expression)) {
			return false;
		}
		return this.append_object_elements(source_expression, elements);
	}

	/** Responsibilities: _collection object source registration_. **/
	private register_object_source(declaration: ts.VariableDeclaration): void {
		if (!ts.isIdentifier(declaration.name)) {
			return;
		}
		if (declaration.initializer === undefined) {
			return;
		}
		let source_expression = this._expression_names.unwrap_transparent_expression(declaration.initializer);
		if (ts.isIdentifier(source_expression)) {
			const source = this._object_sources.get(source_expression.text);
			if (source === undefined) {
				return;
			}
			source_expression = source;
		}
		if (ts.isObjectLiteralExpression(source_expression)) {
			this._object_sources.set(declaration.name.text, source_expression);
		}
	}

	/** Responsibilities: _initialization destructured alias names_. **/
	public constructor(names: Set<string>, source_file: ts.SourceFile) {
		this._expression_names = new TypeScriptExpressionNames();
		this._object_sources = new Map<string, ts.ObjectLiteralExpression>();
		this._names = names;
		this._namespace_aliases = new TypeScriptNamespaceAliases(source_file);
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
		if (declaration.initializer === undefined) {
			return false;
		}
		return this.append_object_source(declaration.initializer, declaration.name.elements);
	}
}
