import type { ObjectPropertyIndex } from "src/model_types";
import { TypeScriptStaticArrayExpressionBindings } from "src/parser/typescript-aliases/callables/static-array/type_script_static_array_expression_bindings";
import type {
	TypeScriptStaticArrayExpressionBindingsContract,
	TypeScriptStaticExpressionBindingsContract,
	TypeScriptStaticExpressionSourceCandidate,
	TypeScriptStaticObjectBindingCollection,
	TypeScriptStaticObjectBindingDeclaration,
	TypeScriptStaticObjectBindingSource,
	TypeScriptStaticObjectBindingTarget,
} from "src/parser/typescript-aliases/protocols";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { CallableMapValueAppender } from "src/runtime_types";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _object destructuring alias collection_, _assignment alias collection_. **/
export class TypeScriptStaticExpressionBindings implements TypeScriptStaticExpressionBindingsContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly _object_sources: Map<string, ts.ObjectLiteralExpression>;
	private readonly _object_properties: WeakMap<ts.ObjectLiteralExpression, ObjectPropertyIndex>;
	private readonly _append_value: CallableMapValueAppender;
	private readonly _array_bindings: TypeScriptStaticArrayExpressionBindingsContract;

	/** Responsibilities: _static object property index_. **/
	private property_index(source: ts.ObjectLiteralExpression): ObjectPropertyIndex {
		const existing = this._object_properties.get(source);
		if (existing !== undefined) {
			return existing;
		}
		const properties = new Map<string, ts.PropertyAssignment>();
		for (const candidate of source.properties) {
			if (!ts.isPropertyAssignment(candidate)) {
				continue;
			}
			const name = this._expression_names.static_property_name(candidate.name);
			if (!properties.has(name)) {
				properties.set(name, candidate);
			}
		}
		this._object_properties.set(source, properties);
		return properties;
	}

	/** Responsibilities: _static object source literal_. **/
	private append_object_source(candidate: TypeScriptStaticExpressionSourceCandidate): boolean {
		const { name, current } = candidate;
		if (!ts.isObjectLiteralExpression(current) || this._object_sources.has(name)) {
			return false;
		}
		this._object_sources.set(name, current);
		return true;
	}

	/** Responsibilities: _static object source alias_. **/
	private append_object_alias(candidate: TypeScriptStaticExpressionSourceCandidate): boolean {
		const { name, current } = candidate;
		if (!ts.isIdentifier(current) || this._object_sources.has(name)) {
			return false;
		}
		const source = this._object_sources.get(current.text);
		if (source === undefined) {
			return false;
		}
		this._object_sources.set(name, source);
		return true;
	}

	/** Responsibilities: _object property alias resolution_. **/
	private append_property_value(context: TypeScriptStaticObjectBindingTarget): boolean {
		const { values, element, source } = context;
		if (!ts.isIdentifier(element.name) || element.dotDotDotToken) {
			return false;
		}
		let source_name = element.name.text;
		if (element.propertyName !== undefined) {
			source_name = this._expression_names.static_property_name(element.propertyName);
		}
		const candidate = this.property_index(source).get(source_name);
		if (candidate === undefined || !ts.isIdentifier(element.name)) {
			return false;
		}
		return this._append_value(values, element.name.text, candidate.initializer);
	}

	/** Responsibilities: _static object binding properties_. **/
	private append_object_elements(context: TypeScriptStaticObjectBindingCollection): boolean {
		const { values, binding, source } = context;
		let changed = false;
		for (const element of binding.elements) {
			if (!ts.isBindingElement(element)) {
				continue;
			}
			if (this.append_property_value({ values, element, source })) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _static object binding source_. **/
	private append_binding_source(context: TypeScriptStaticObjectBindingSource): boolean {
		const { values, binding, current } = context;
		if (ts.isObjectLiteralExpression(current)) {
			return this.append_object_elements({ values, binding, source: current });
		}
		if (!ts.isIdentifier(current)) {
			return false;
		}
		const source = this._object_sources.get(current.text);
		if (source === undefined) {
			return false;
		}
		return this.append_object_elements({ values, binding, source });
	}

	/** Responsibilities: _static object binding values_. **/
	private append_object_binding(context: TypeScriptStaticObjectBindingDeclaration): boolean {
		const { values, node } = context;
		if (!ts.isObjectBindingPattern(node.name)) {
			return false;
		}
		if (node.initializer === undefined) {
			return false;
		}
		const current = this._expression_aliases.unwrapped(node.initializer);
		return this.append_binding_source({ values, binding: node.name, current });
	}

	/** Responsibilities: _static binding dependencies_. **/
	public constructor(append_value: CallableMapValueAppender) {
		this._expression_names = new TypeScriptExpressionNames();
		this._expression_aliases = new TypeScriptExpressionAliases("", new TypeScriptObjectAliasDeclarationIndex());
		this._object_sources = new Map<string, ts.ObjectLiteralExpression>();
		this._object_properties = new WeakMap<ts.ObjectLiteralExpression, ObjectPropertyIndex>();
		this._append_value = append_value;
		this._array_bindings = new TypeScriptStaticArrayExpressionBindings(append_value);
	}

	/** Responsibilities: _static object source collection_. **/
	public append_source(node: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(node.name)) {
			return false;
		}
		if (node.initializer === undefined) {
			return false;
		}
		const current = this._expression_aliases.unwrapped(node.initializer);
		const candidate = { name: node.name.text, current };
		if (this.append_object_source(candidate)) {
			return true;
		}
		if (this.append_object_alias(candidate)) {
			return true;
		}
		return false;
	}

	/** Responsibilities: _static object alias collection_. **/
	public append(values: Map<string, string>, node: ts.VariableDeclaration): boolean {
		let changed = this.append_source(node);
		if (this.append_object_binding({ values, node })) {
			changed = true;
		}
		if (this._array_bindings.append(values, node)) {
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
		return this._array_bindings.append_assignment(node);
	}
}
