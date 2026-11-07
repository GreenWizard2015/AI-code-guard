import type { StaticExpressionScopeValues, StaticExpressionValueMap } from "src/model_types";
import { TypeScriptStaticExpressionBindings } from "src/parser/typescript-aliases/callables/type_script_static_expression_bindings";
import { TypeScriptStaticExpressionScopeIndex } from "src/parser/typescript-aliases/callables/type_script_static_expression_scope_index";
import type {
	TypeScriptStaticExpressionScopeCollection,
	TypeScriptStaticExpressionScopesCollection,
	TypeScriptStaticExpressionTraversal,
	TypeScriptStaticExpressionValueCollection,
} from "src/parser/typescript-aliases/callables/types";
import type { StaticExpressionOperationsContract, StaticExpressionValuesContract } from "src/shared_services_protocols";
import ts from "typescript";

/** Responsibilities: _scoped expression value resolution_, _shadow binding resolution_. **/
export class TypeScriptStaticExpressionValues implements StaticExpressionValuesContract {
	private readonly _operations: StaticExpressionOperationsContract;
	private readonly _resolved_scope_values: WeakMap<ts.Node, StaticExpressionValueMap>;
	private readonly _scope_index: TypeScriptStaticExpressionScopeIndex;

	/** Responsibilities: _variable initializer value collection_. **/
	private append_variable_value(context: TypeScriptStaticExpressionValueCollection<ts.VariableDeclaration>): boolean {
		const { values, node, bindings } = context;
		const changed = bindings.append(values, node);
		if (node.initializer === undefined || !ts.isIdentifier(node.name)) {
			return changed;
		}
		const value_added = this._operations.append(values, node.name.text, node.initializer);
		if (value_added) {
			return true;
		}
		return changed;
	}

	/** Responsibilities: _assignment value collection_. **/
	private append_assignment_value(context: TypeScriptStaticExpressionValueCollection<ts.BinaryExpression>): boolean {
		const { values, node, bindings } = context;
		const changed = bindings.append_assignment(node);
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken || !ts.isIdentifier(node.left)) {
			return changed;
		}
		const value_added = this._operations.append(values, node.left.text, node.right);
		if (value_added) {
			return true;
		}
		return changed;
	}

	/** Responsibilities: _scope binding value collection_. **/
	private append_binding_value(context: TypeScriptStaticExpressionValueCollection): boolean {
		const { values, node, bindings } = context;
		if (ts.isVariableDeclaration(node)) {
			return this.append_variable_value({ values, node, bindings });
		}
		if (ts.isBinaryExpression(node)) {
			return this.append_assignment_value({ values, node, bindings });
		}
		return false;
	}

	/** Responsibilities: _static scope value traversal_. **/
	private append_node(context: TypeScriptStaticExpressionTraversal): boolean {
		const { values, node, root, bindings } = context;
		if (node !== root && ts.isFunctionLike(node)) {
			return false;
		}
		let changed = this.append_binding_value({ values, node, bindings });
		node.forEachChild((child) => {
			if (this.append_node({ values, node: child, root, bindings })) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _scope value collection_. **/
	private collect_scope_values(context: TypeScriptStaticExpressionScopeCollection): ReadonlyMap<string, string> {
		const { scope, bindings } = context;
		const values = new Map<string, string>();
		let changed = true;
		while (changed) {
			changed = this.append_node({ values, node: scope, root: scope, bindings });
		}
		return values;
	}

	/** Responsibilities: _scope values by owner_. **/
	private values_by_scope(context: TypeScriptStaticExpressionScopesCollection): StaticExpressionScopeValues {
		const { scopes, bindings } = context;
		const values = new Map<ts.Node, StaticExpressionValueMap>();
		for (const scope of scopes) {
			values.set(scope, this.collect_scope_values({ scope, bindings }));
		}
		return values;
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
			for (const name of this._scope_index.binding_names(scope)) {
				hidden_names.add(name);
			}
			return;
		}
		for (const [name, value] of scoped_values) {
			if (hidden_names.has(name)) {
				continue;
			}
			values.set(name, value);
		}
		for (const name of this._scope_index.binding_names(scope)) {
			hidden_names.add(name);
		}
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
		this._operations = operations;
		this._resolved_scope_values = new WeakMap<ts.Node, StaticExpressionValueMap>();
		this._scope_index = new TypeScriptStaticExpressionScopeIndex();
	}

	/** Responsibilities: _static value map resolution_. **/
	public values(node: ts.Node): StaticExpressionValueMap {
		const scope_path = this._scope_index.resolve({ node });
		const owner = scope_path.owner;
		const cached = this._resolved_scope_values.get(owner);
		if (cached !== undefined) {
			return cached;
		}
		const bindings = new TypeScriptStaticExpressionBindings((target, name, initializer) =>
			this._operations.append(target, name, initializer),
		);
		const scopes = scope_path.scopes;
		const values = this.visible_values(scopes, this.values_by_scope({ scopes, bindings }));
		this._resolved_scope_values.set(owner, values);
		return values;
	}

	/** Responsibilities: _static expression value lookup_. **/
	public value(expression: ts.Expression, node: ts.Node): string {
		const values = this.values(node);
		const literal = this._operations.literal(values, expression);
		if (literal !== "") {
			return literal;
		}
		const current = this._operations.unwrapped(expression);
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
