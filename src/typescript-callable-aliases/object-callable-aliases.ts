import ts from "typescript";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/typescript-expression-aliases";
import { TypeScriptContractBindings } from "src/typescript-callable-aliases/contract-bindings";
import { TypeScriptCallableTypeProperties } from "src/typescript-callable-aliases/callable-type-properties";
import { TypeScriptTypedCallableBindings } from "src/typescript-callable-aliases/typed-callable-bindings";

/** Responsibilities: _typed callable object resolution_. **/
export class TypeScriptObjectCallableAliases {
	private readonly contract_bindings = new TypeScriptContractBindings();
	private readonly property_names = new TypeScriptCallableTypeProperties();
	private readonly typed_bindings = new TypeScriptTypedCallableBindings();
	private readonly expression_aliases = new TypeScriptExpressionAliases("");

	/** Responsibilities: _callable alias name extension_. **/
	private append_name(aliases: Set<string>, name: string): boolean {
		if (name.length === 0) {
			return false;
		}
		if (aliases.has(name)) {
			return false;
		}
		aliases.add(name);
		return true;
	}

	/** Responsibilities: _typed object alias extension_. **/
	private append_instance_alias(
		objects: Map<string, Set<string>>,
		interfaces: Map<string, Set<string>>,
		name: string,
		expression: ts.NewExpression,
	): boolean {
		if (!ts.isIdentifier(expression.expression)) {
			return false;
		}
		const properties = interfaces.get(expression.expression.text);
		if (properties === undefined) {
			return false;
		}
		objects.set(name, properties);
		return true;
	}

	/** Responsibilities: _typed object alias extension_. **/
	private append_object_alias(
		objects: Map<string, Set<string>>,
		interfaces: Map<string, Set<string>>,
		name: string,
		initializer: ts.Expression,
	): void {
		const current = this.expression_aliases.unwrapped(initializer);
		if (ts.isNewExpression(current)) {
			this.append_instance_alias(objects, interfaces, name, current);
			return;
		}
		if (!ts.isIdentifier(current)) {
			return;
		}
		let properties = objects.get(current.text);
		if (properties === undefined) {
			properties = interfaces.get(current.text);
		}
		if (properties !== undefined) {
			objects.set(name, properties);
		}
	}

	/** Responsibilities: _typed object binding element_. **/
	private append_binding_element(aliases: Set<string>, properties: Set<string>, element: ts.BindingElement): boolean {
		if (!ts.isIdentifier(element.name)) {
			return false;
		}
		let source_name = element.name.text;
		if (element.propertyName !== undefined) {
			source_name = this.property_names.property_name(element.propertyName);
		}
		if (!properties.has(source_name)) {
			return false;
		}
		return this.append_name(aliases, element.name.text);
	}

	/** Responsibilities: _typed object binding properties_. **/
	private append_object_properties(
		aliases: Set<string>,
		binding: ts.ObjectBindingPattern,
		objects: Map<string, Set<string>>,
		interfaces: Map<string, Set<string>>,
		name: string,
	): boolean {
		let properties = objects.get(name);
		if (properties === undefined) {
			properties = interfaces.get(name);
		}
		if (properties === undefined) {
			return false;
		}
		let changed = false;
		for (const element of binding.elements) {
			if (this.append_binding_element(aliases, properties, element)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _typed object destructuring_. **/
	private append_object_binding(
		aliases: Set<string>,
		binding: ts.ObjectBindingPattern,
		initializer: ts.Expression,
		objects: Map<string, Set<string>>,
		interfaces: Map<string, Set<string>>,
	): boolean {
		const current = this.expression_aliases.unwrapped(initializer);
		if (ts.isIdentifier(current)) {
			return this.append_object_properties(aliases, binding, objects, interfaces, current.text);
		}
		if (!ts.isNewExpression(current) || !ts.isIdentifier(current.expression)) {
			return false;
		}
		return this.append_object_properties(aliases, binding, objects, interfaces, current.expression.text);
	}

	/** Responsibilities: _typed object variable collection_. **/
	private append_variable(
		aliases: Set<string>,
		objects: Map<string, Set<string>>,
		interfaces: Map<string, Set<string>>,
		node: ts.VariableDeclaration,
	): boolean {
		if (node.initializer === undefined) {
			this.typed_bindings.variable(objects, interfaces, node);
			return false;
		}
		if (ts.isObjectBindingPattern(node.name)) {
			return this.append_object_binding(aliases, node.name, node.initializer, objects, interfaces);
		}
		if (!ts.isIdentifier(node.name)) {
			return false;
		}
		this.append_object_alias(objects, interfaces, node.name.text, node.initializer);
		return false;
	}

	/** Responsibilities: _typed object node collection_. **/
	private append_node(
		aliases: Set<string>,
		objects: Map<string, Set<string>>,
		interfaces: Map<string, Set<string>>,
		node: ts.Node,
		root: ts.Node,
	): boolean {
		let changed = this.contract_bindings.append(interfaces, node);
		if (ts.isVariableDeclaration(node) && this.append_variable(aliases, objects, interfaces, node)) {
			changed = true;
		}
		if (node !== root) {
			if (ts.isFunctionLike(node)) {
				return changed;
			}
		}
		node.forEachChild((child) => {
			if (this.append_node(aliases, objects, interfaces, child, root)) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _typed object scope collection_. **/
	private collect(scope: ts.Node): ReadonlySet<string> {
		const aliases = new Set<string>();
		const objects = new Map<string, Set<string>>();
		const interfaces = new Map<string, Set<string>>();
		let changed = true;
		while (changed) {
			changed = this.append_node(aliases, objects, interfaces, scope, scope);
		}
		return aliases;
	}

	/** Responsibilities: _typed object scope traversal_. **/
	private scopes(node: ts.Node): ts.Node[] {
		const scopes: ts.Node[] = [];
		let current = node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				scopes.push(current);
			}
			current = current.parent;
		}
		scopes.push(current);
		return scopes;
	}

	/** Responsibilities: _typed object alias collection_. **/
	public names(node: ts.Node): ReadonlySet<string> {
		const names = new Set<string>();
		for (const scope of this.scopes(node)) {
			for (const name of this.collect(scope)) {
				names.add(name);
			}
		}
		return names;
	}

	/** Responsibilities: _typed object alias classification_. **/
	public contains(expression: ts.Expression, node: ts.Node): boolean {
		const current = this.expression_aliases.unwrapped(expression);
		if (!ts.isIdentifier(current)) {
			return false;
		}
		const names = this.names(node);
		return names.has(current.text);
	}
}
