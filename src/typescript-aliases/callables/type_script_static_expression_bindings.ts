import ts from "typescript";
import type { MapValueAppender } from "src/runtime_types";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptStaticArrayExpressionBindingsContract, TypeScriptStaticExpressionBindingsContract } from "src/typescript_analysis_protocols";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";
import { TypeScriptExpressionNames } from "src/typescript-aliases/type_script_expression_names";
import { TypeScriptStaticArrayExpressionBindings } from "src/typescript-aliases/callables/static-array/type_script_static_array_expression_bindings";
import type { ObjectPropertyIndex } from "src/model/types/types";

/** Responsibilities: _object destructuring alias collection_, _assignment alias collection_. **/
export class TypeScriptStaticExpressionBindings implements TypeScriptStaticExpressionBindingsContract {
	private readonly expression_names: ExpressionNamesContract;
	private readonly expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly object_sources: Map<string, ts.ObjectLiteralExpression>;
	private readonly object_properties: WeakMap<ts.ObjectLiteralExpression, ObjectPropertyIndex>;
	private readonly append_value: MapValueAppender;
	private readonly array_bindings: TypeScriptStaticArrayExpressionBindingsContract;

	/** Responsibilities: _static object property index_. **/
	private property_index(source: ts.ObjectLiteralExpression): ObjectPropertyIndex {
		const existing = this.object_properties.get(source);
		if (existing !== undefined) {
			return existing;
		}
		const properties = new Map<string, ts.PropertyAssignment>();
		for (const candidate of source.properties) {
			if (!ts.isPropertyAssignment(candidate)) {
				continue;
			}
			const name = this.expression_names.static_property_name(candidate.name);
			if (!properties.has(name)) {
				properties.set(name, candidate);
			}
		}
		this.object_properties.set(source, properties);
		return properties;
	}

	/** Responsibilities: _static object source literal_. **/
	private append_object_source(name: string, current: ts.Expression): boolean {
		if (!ts.isObjectLiteralExpression(current) || this.object_sources.has(name)) {
			return false;
		}
		this.object_sources.set(name, current);
		return true;
	}

	/** Responsibilities: _static object source alias_. **/
	private append_object_alias(name: string, current: ts.Expression): boolean {
		if (!ts.isIdentifier(current) || this.object_sources.has(name)) {
			return false;
		}
		const source = this.object_sources.get(current.text);
		if (source === undefined) {
			return false;
		}
		this.object_sources.set(name, source);
		return true;
	}

	/** Responsibilities: _object property alias resolution_. **/
	private append_property_value(
		values: Map<string, string>,
		element: ts.BindingElement,
		source_name: string,
		source: ts.ObjectLiteralExpression,
	): boolean {
		const candidate = this.property_index(source).get(source_name);
		if (candidate === undefined || !ts.isIdentifier(element.name)) {
			return false;
		}
		return this.append_value(values, element.name.text, candidate.initializer);
	}

	/** Responsibilities: _static object binding element_. **/
	private append_object_element(
		values: Map<string, string>,
		element: ts.BindingElement,
		source: ts.ObjectLiteralExpression,
	): boolean {
		if (!ts.isIdentifier(element.name) || element.dotDotDotToken) {
			return false;
		}
		let source_name = element.name.text;
		if (element.propertyName !== undefined) {
			source_name = this.expression_names.static_property_name(element.propertyName);
		}
		return this.append_property_value(values, element, source_name, source);
	}

	/** Responsibilities: _static object binding properties_. **/
	private append_object_elements(
		values: Map<string, string>,
		binding: ts.ObjectBindingPattern,
		source: ts.ObjectLiteralExpression,
	): boolean {
		let changed = false;
		for (const element of binding.elements) {
			if (!ts.isBindingElement(element)) {
				continue;
			}
			if (this.append_object_element(values, element, source)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _static object binding source_. **/
	private append_binding_source(
		values: Map<string, string>,
		binding: ts.ObjectBindingPattern,
		current: ts.Expression,
	): boolean {
		if (ts.isObjectLiteralExpression(current)) {
			return this.append_object_elements(values, binding, current);
		}
		if (!ts.isIdentifier(current)) {
			return false;
		}
		const source = this.object_sources.get(current.text);
		if (source === undefined) {
			return false;
		}
		return this.append_object_elements(values, binding, source);
	}

	/** Responsibilities: _static object binding values_. **/
	private append_object_binding(values: Map<string, string>, node: ts.VariableDeclaration): boolean {
		if (!ts.isObjectBindingPattern(node.name)) {
			return false;
		}
		if (node.initializer === undefined) {
			return false;
		}
		const current = this.expression_aliases.unwrapped(node.initializer);
		return this.append_binding_source(values, node.name, current);
	}

	/** Responsibilities: _static binding dependencies_. **/
	public constructor(append_value: MapValueAppender) {
		this.expression_names = new TypeScriptExpressionNames();
		this.expression_aliases = new TypeScriptExpressionAliases("");
		this.object_sources = new Map<string, ts.ObjectLiteralExpression>();
		this.object_properties = new WeakMap<ts.ObjectLiteralExpression, ObjectPropertyIndex>();
		this.append_value = append_value;
		this.array_bindings = new TypeScriptStaticArrayExpressionBindings(append_value);
	}

	/** Responsibilities: _static object source collection_. **/
	public append_source(node: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(node.name)) {
			return false;
		}
		if (node.initializer === undefined) {
			return false;
		}
		const current = this.expression_aliases.unwrapped(node.initializer);
		if (this.append_object_source(node.name.text, current)) {
			return true;
		}
		if (this.append_object_alias(node.name.text, current)) {
			return true;
		}
		return false;
	}

	/** Responsibilities: _static object alias collection_. **/
	public append(values: Map<string, string>, node: ts.VariableDeclaration): boolean {
		let changed = this.append_source(node);
		if (this.append_object_binding(values, node)) {
			changed = true;
		}
		if (this.array_bindings.append(values, node)) {
			changed = true;
		}
		return changed;
	}

	/** Responsibilities: _static assignment alias collection_. **/
	public append_assignment(node: ts.BinaryExpression): boolean {
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		if (!ts.isIdentifier(node.left)) {
			return false;
		}
		return this.array_bindings.append_assignment(node);
	}
}
