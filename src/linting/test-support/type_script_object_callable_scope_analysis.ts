import type { StringSetMap } from "src/analysis_types";
import type {
	TypeScriptCallableTypeBindingsContract,
	TypeScriptObjectCallableScopeAnalysisContract,
	TypeScriptObjectCallableScopeAnalysisOptions,
} from "src/linting/test-support/protocols";
import { TypeScriptCallableTypeBindings } from "src/linting/test-support/type_script_callable_type_bindings";
import { TypeScriptTypedCallableBindings } from "src/parser/typescript-aliases/callables/type_script_typed_callable_bindings";
import type {
	TypeScriptCallableTypePropertiesContract,
	TypeScriptExpressionAliasesContract,
	TypeScriptTypedCallableBindingsContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _typed scope state_, _callable alias propagation_. **/
export class TypeScriptObjectCallableScopeAnalysis implements TypeScriptObjectCallableScopeAnalysisContract {
	private readonly _root: ts.Node;
	private readonly _property_names: TypeScriptCallableTypePropertiesContract;
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly _contract_bindings: TypeScriptCallableTypeBindingsContract;
	private readonly _typed_callable_bindings: TypeScriptTypedCallableBindingsContract;
	private readonly _aliases: Set<string>;
	private readonly _objects: StringSetMap;
	private readonly _interfaces: StringSetMap;

	/** Responsibilities: _alias registration_. **/
	private append_name(name: string): boolean {
		if (name.length === 0 || this._aliases.has(name)) {
			return false;
		}
		this._aliases.add(name);
		return true;
	}

	/** Responsibilities: _typed instance alias registration_. **/
	private append_instance_alias(target: ts.Identifier, expression: ts.NewExpression): boolean {
		if (!ts.isIdentifier(expression.expression)) {
			return false;
		}
		const properties = this._interfaces.get(expression.expression.text);
		if (properties === undefined || this._objects.has(target.text)) {
			return false;
		}
		this._objects.set(target.text, properties);
		return true;
	}

	/** Responsibilities: _typed object alias registration_. **/
	private append_object_alias(target: ts.Identifier, initializer: ts.Expression): boolean {
		const current = this._expression_aliases.unwrapped(initializer);
		if (ts.isNewExpression(current)) {
			return this.append_instance_alias(target, current);
		}
		if (!ts.isIdentifier(current) || this._objects.has(target.text)) {
			return false;
		}
		let properties = this._objects.get(current.text);
		if (properties === undefined) {
			properties = this._interfaces.get(current.text);
		}
		if (properties === undefined) {
			return false;
		}
		this._objects.set(target.text, properties);
		return true;
	}

	/** Responsibilities: _typed binding element registration_. **/
	private append_binding_element(element: ts.BindingElement, source_properties: Set<string>): boolean {
		if (!ts.isIdentifier(element.name)) {
			return false;
		}
		let source_name = element.name.text;
		if (element.propertyName !== undefined) {
			source_name = this._property_names.property_name(element.propertyName);
		}
		if (!source_properties.has(source_name)) {
			return false;
		}
		return this.append_name(element.name.text);
	}

	/** Responsibilities: _property alias collection_. **/
	private append_object_properties(binding: ts.ObjectBindingPattern, source_name: string): boolean {
		let source_properties = this._objects.get(source_name);
		if (source_properties === undefined) {
			source_properties = this._interfaces.get(source_name);
		}
		if (source_properties === undefined) {
			return false;
		}
		let changed = false;
		for (const element of binding.elements) {
			if (this.append_binding_element(element, source_properties)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _typed object destructuring_. **/
	private append_object_binding(binding: ts.ObjectBindingPattern, initializer: ts.Expression): boolean {
		const current = this._expression_aliases.unwrapped(initializer);
		if (ts.isIdentifier(current)) {
			return this.append_object_properties(binding, current.text);
		}
		if (!ts.isNewExpression(current) || !ts.isIdentifier(current.expression)) {
			return false;
		}
		return this.append_object_properties(binding, current.expression.text);
	}

	/** Responsibilities: _typed variable processing_. **/
	private append_variable(declaration: ts.VariableDeclaration): boolean {
		if (declaration.initializer === undefined) {
			this._typed_callable_bindings.variable(declaration);
			return false;
		}
		if (ts.isObjectBindingPattern(declaration.name)) {
			return this.append_object_binding(declaration.name, declaration.initializer);
		}
		if (!ts.isIdentifier(declaration.name)) {
			return false;
		}
		return this.append_object_alias(declaration.name, declaration.initializer);
	}

	/** Responsibilities: _typed object AST traversal_. **/
	private append_node(node: ts.Node): boolean {
		let changed = this._contract_bindings.append(node);
		if (ts.isVariableDeclaration(node) && this.append_variable(node)) {
			changed = true;
		}
		if (node !== this._root && ts.isFunctionLike(node)) {
			return changed;
		}
		node.forEachChild((child) => {
			if (this.append_node(child)) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _scope analysis setup_. **/
	public constructor(options: TypeScriptObjectCallableScopeAnalysisOptions) {
		this._root = options.root;
		this._property_names = options.property_names;
		this._expression_aliases = options.expression_aliases;
		this._aliases = new Set();
		this._objects = new Map();
		this._interfaces = new Map();
		this._typed_callable_bindings = new TypeScriptTypedCallableBindings(
			this._objects,
			this._interfaces,
			this._property_names,
		);
		this._contract_bindings = new TypeScriptCallableTypeBindings(this._interfaces, this._typed_callable_bindings);
	}

	/** Responsibilities: _typed object scope pass_. **/
	public append(): boolean {
		return this.append_node(this._root);
	}

	/** Responsibilities: _typed object alias result_. **/
	public names(): ReadonlySet<string> {
		return this._aliases;
	}
}
