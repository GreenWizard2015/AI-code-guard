import ts from "typescript";
import { TypeScriptStaticExpressionBindings } from "src/typescript-aliases/callables/type_script_static_expression_bindings";
import type {
	StaticExpressionOperationsContract,
	StaticExpressionValuesContract,
	TypeScriptStaticExpressionBindingsContract,
} from "src/protocols";
import type {
	StaticExpressionBindingNames,
	StaticExpressionScopeValues,
	StaticExpressionValueMap,
} from "src/typescript-aliases/callables/types";

/** Responsibilities: _scoped expression value resolution_, _shadow binding resolution_. **/
export class TypeScriptStaticExpressionValues implements StaticExpressionValuesContract {
	private readonly operations: StaticExpressionOperationsContract;
	private readonly resolved_scope_values: WeakMap<ts.Node, StaticExpressionValueMap>;
	private readonly scope_binding_names: WeakMap<ts.Node, StaticExpressionBindingNames>;

	/** Responsibilities: _variable initializer value collection_. **/
	private append_variable_value(
		values: Map<string, string>,
		node: ts.VariableDeclaration,
		bindings: TypeScriptStaticExpressionBindingsContract,
	): boolean {
		const changed = bindings.append(values, node);
		if (node.initializer === undefined || !ts.isIdentifier(node.name)) {
			return changed;
		}
		const value_added = this.operations.append(values, node.name.text, node.initializer);
		if (value_added) {
			return true;
		}
		return changed;
	}

	/** Responsibilities: _assignment value collection_. **/
	private append_assignment_value(
		values: Map<string, string>,
		node: ts.BinaryExpression,
		bindings: TypeScriptStaticExpressionBindingsContract,
	): boolean {
		const changed = bindings.append_assignment(node);
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken || !ts.isIdentifier(node.left)) {
			return changed;
		}
		const value_added = this.operations.append(values, node.left.text, node.right);
		if (value_added) {
			return true;
		}
		return changed;
	}

	/** Responsibilities: _scope binding value collection_. **/
	private append_binding_value(
		values: Map<string, string>,
		node: ts.Node,
		bindings: TypeScriptStaticExpressionBindingsContract,
	): boolean {
		if (ts.isVariableDeclaration(node)) {
			return this.append_variable_value(values, node, bindings);
		}
		if (ts.isBinaryExpression(node)) {
			return this.append_assignment_value(values, node, bindings);
		}
		return false;
	}

	/** Responsibilities: _static scope value traversal_. **/
	private append_node(
		values: Map<string, string>,
		node: ts.Node,
		root: ts.Node,
		bindings: TypeScriptStaticExpressionBindingsContract,
	): boolean {
		if (node !== root && ts.isFunctionLike(node)) {
			return false;
		}
		let changed = this.append_binding_value(values, node, bindings);
		node.forEachChild((child) => {
			if (this.append_node(values, child, root, bindings)) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _nested scope binding indexing_. **/
	private append_binding_names(names: Set<string>, node: ts.Node, root: ts.Node): void {
		if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
			if (ts.isIdentifier(node.name)) {
				names.add(node.name.text);
			}
			return;
		}
		if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name !== undefined) {
			names.add(node.name.text);
		}
		if (node !== root && ts.isFunctionLike(node)) {
			return;
		}
		node.forEachChild((child) => this.append_binding_names(names, child, root));
	}

	/** Responsibilities: _scope binding names_. **/
	private collect_binding_names(scope: ts.Node): ReadonlySet<string> {
		const names = new Set<string>();
		this.append_binding_names(names, scope, scope);
		return names;
	}

	/** Responsibilities: _scope value collection_. **/
	private collect_scope_values(
		scope: ts.Node,
		bindings: TypeScriptStaticExpressionBindingsContract,
	): ReadonlyMap<string, string> {
		const values = new Map<string, string>();
		let changed = true;
		while (changed) {
			changed = this.append_node(values, scope, scope, bindings);
		}
		return values;
	}

	/** Responsibilities: _enclosing scope lookup_. **/
	private scope_owner(node: ts.Node): ts.Node {
		let current = node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				return current;
			}
			current = current.parent;
		}
		return current;
	}

	/** Responsibilities: _enclosing scope collection_. **/
	private scopes(node: ts.Node): ts.Node[] {
		const scopes: ts.Node[] = [];
		let current = this.scope_owner(node);
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				scopes.push(current);
			}
			current = current.parent;
		}
		scopes.push(current);
		return scopes;
	}

	/** Responsibilities: _scope values by owner_. **/
	private values_by_scope(
		scopes: readonly ts.Node[],
		bindings: TypeScriptStaticExpressionBindingsContract,
	): StaticExpressionScopeValues {
		const values = new Map<ts.Node, StaticExpressionValueMap>();
		for (const scope of scopes) {
			values.set(scope, this.collect_scope_values(scope, bindings));
		}
		return values;
	}

	/** Responsibilities: _binding name cache_. **/
	private binding_names(scope: ts.Node): ReadonlySet<string> {
		const cached = this.scope_binding_names.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const names = this.collect_binding_names(scope);
		this.scope_binding_names.set(scope, names);
		return names;
	}

	/** Responsibilities: _scope shadow registration_. **/
	private append_hidden_names(scope: ts.Node, hidden_names: Set<string>): void {
		for (const name of this.binding_names(scope)) {
			hidden_names.add(name);
		}
	}

	/** Responsibilities: _visible scope value registration_. **/
	private append_scope_values(
		scope: ts.Node,
		by_scope: StaticExpressionScopeValues,
		hidden_names: Set<string>,
		values: Map<string, string>,
	): void {
		const scoped_values = by_scope.get(scope);
		if (scoped_values === undefined) {
			this.append_hidden_names(scope, hidden_names);
			return;
		}
		for (const [name, value] of scoped_values) {
			if (hidden_names.has(name)) {
				continue;
			}
			values.set(name, value);
		}
		this.append_hidden_names(scope, hidden_names);
	}

	/** Responsibilities: _scope value shadowing_. **/
	private visible_values(scopes: readonly ts.Node[], by_scope: StaticExpressionScopeValues): Map<string, string> {
		const values = new Map<string, string>();
		const hidden_names = new Set<string>();
		for (const scope of scopes) {
			this.append_scope_values(scope, by_scope, hidden_names, values);
		}
		return values;
	}

	/** Responsibilities: _static expression value dependencies_. **/
	public constructor(operations: StaticExpressionOperationsContract) {
		this.operations = operations;
		this.resolved_scope_values = new WeakMap<ts.Node, StaticExpressionValueMap>();
		this.scope_binding_names = new WeakMap<ts.Node, ReadonlySet<string>>();
	}

	/** Responsibilities: _static value map resolution_. **/
	public values(node: ts.Node): StaticExpressionValueMap {
		const owner = this.scope_owner(node);
		const cached = this.resolved_scope_values.get(owner);
		if (cached !== undefined) {
			return cached;
		}
		const scopes = this.scopes(node);
		const bindings = new TypeScriptStaticExpressionBindings((target, name, initializer) =>
			this.operations.append(target, name, initializer),
		);
		const values = this.visible_values(scopes, this.values_by_scope(scopes, bindings));
		this.resolved_scope_values.set(owner, values);
		return values;
	}

	/** Responsibilities: _static expression value lookup_. **/
	public value(expression: ts.Expression, node: ts.Node): string {
		const values = this.values(node);
		const literal = this.operations.literal(values, expression);
		if (literal !== "") {
			return literal;
		}
		const current = this.operations.unwrapped(expression);
		if (!ts.isIdentifier(current)) {
			return "";
		}
		const value = values.get(current.text);
		if (value === undefined) {
			return "";
		}
		return value;
	}
}
