import type {
	TypeScriptStaticExpressionBindingNameCache,
	TypeScriptStaticExpressionBindingNameTraversal,
	TypeScriptStaticExpressionScopePath,
} from "src/parser/typescript-aliases/callables/types";
import type { TypeScriptStaticExpressionNodeQuery } from "src/parser/typescript-aliases/protocols";
import ts from "typescript";

/** Responsibilities: _lexical scope resolution_, _scope binding index_. **/
export class TypeScriptStaticExpressionScopeIndex {
	private readonly _scope_binding_names: TypeScriptStaticExpressionBindingNameCache;

	/** Responsibilities: _binding name traversal_. **/
	private append_binding_names(context: TypeScriptStaticExpressionBindingNameTraversal): void {
		const { names, node, root } = context;
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
		node.forEachChild((child) => this.append_binding_names({ names, node: child, root }));
	}

	/** Responsibilities: _enclosing scope lookup_. **/
	private scope_owner(source: TypeScriptStaticExpressionNodeQuery): ts.Node {
		const { node } = source;
		let current = node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				return current;
			}
			current = current.parent;
		}
		return current;
	}

	/** Responsibilities: _scope index initialization_. **/
	public constructor() {
		this._scope_binding_names = new WeakMap<ts.Node, ReadonlySet<string>>();
	}

	/** Responsibilities: _expression scope path lookup_. **/
	public resolve(source: TypeScriptStaticExpressionNodeQuery): TypeScriptStaticExpressionScopePath {
		const scopes: ts.Node[] = [];
		const owner = this.scope_owner(source);
		let current = owner;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				scopes.push(current);
			}
			current = current.parent;
		}
		scopes.push(current);
		return { owner, scopes };
	}

	/** Responsibilities: _scope binding-name cache_. **/
	public binding_names(scope: ts.Node): ReadonlySet<string> {
		const cached = this._scope_binding_names.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const names = new Set<string>();
		this.append_binding_names({ names, node: scope, root: scope });
		this._scope_binding_names.set(scope, names);
		return names;
	}
}
