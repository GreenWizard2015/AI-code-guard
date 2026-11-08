import type { JestNodeScopes, JestScopeBindingMaps, JestScopeParents } from "src/model_types";
import type { JestBindingIndexContract, JestDeclarationBindingRegistration } from "src/testing_protocols";
import ts from "typescript";

/** Responsibilities: _Jest lexical declaration identity_, _scope shadow resolution_. **/
export class JestBindingIndex implements JestBindingIndexContract {
	private readonly _bindings: JestScopeBindingMaps;
	private readonly _parent_scopes: JestScopeParents;
	private readonly _node_scopes: JestNodeScopes;
	private readonly _source_file: ts.SourceFile;
	private readonly _indexed_sources: WeakSet<ts.SourceFile>;
	private readonly _async_declarations: Set<ts.Declaration>;

	/** Responsibilities: _lexical scope boundary selection_. **/
	private scope_boundary(scope_candidate: ts.Node, inherited_scope: ts.Node): ts.Node {
		if (scope_candidate === this._source_file) {
			return inherited_scope;
		}
		if (ts.isBlock(scope_candidate) || ts.isFunctionLike(scope_candidate)) {
			return scope_candidate;
		}
		return inherited_scope;
	}

	/** Responsibilities: _scope binding registration_. **/
	private register(scope: ts.Node, name: string, declaration: ts.Declaration): void {
		let bindings = this._bindings.get(scope);
		if (bindings === undefined) {
			bindings = new Map<string, ts.Declaration>();
			this._bindings.set(scope, bindings);
		}
		if (!bindings.has(name)) {
			bindings.set(name, declaration);
		}
	}

	/** Responsibilities: _declaration name registration_. **/
	private register_declaration(registration: JestDeclarationBindingRegistration): void {
		if (this.register_binding(registration.scope, registration.candidate)) {
			return;
		}
		if (ts.isFunctionDeclaration(registration.candidate) && registration.candidate.name !== undefined) {
			this.register(registration.scope, registration.candidate.name.text, registration.candidate);
			if (this.async_callable(registration.candidate)) {
				this._async_declarations.add(registration.candidate);
			}
			return;
		}
		if (ts.isClassDeclaration(registration.candidate) && registration.candidate.name !== undefined) {
			this.register(registration.scope, registration.candidate.name.text, registration.candidate);
		}
	}

	/** Responsibilities: _local binding registration_. **/
	private register_binding(scope: ts.Node, candidate: ts.Node): boolean {
		if (ts.isVariableDeclaration(candidate)) {
			if (!ts.isIdentifier(candidate.name)) {
				return false;
			}
			this.register(scope, candidate.name.text, candidate);
			return true;
		}
		if (!ts.isParameter(candidate)) {
			return false;
		}
		if (!ts.isIdentifier(candidate.name)) {
			return false;
		}
		this.register(scope, candidate.name.text, candidate);
		return true;
	}

	/** Responsibilities: _scope binding collection_. **/
	private collect(traversal_node: ts.Node, inherited_scope: ts.Node): void {
		const active_scope = this.scope_boundary(traversal_node, inherited_scope);
		const has_new_scope = active_scope !== inherited_scope;
		if (has_new_scope) {
			this._bindings.set(active_scope, new Map<string, ts.Declaration>());
			this._parent_scopes.set(active_scope, inherited_scope);
		}
		this._node_scopes.set(traversal_node, active_scope);
		if (ts.isFunctionDeclaration(traversal_node) || ts.isClassDeclaration(traversal_node)) {
			this.register_declaration({ scope: inherited_scope, candidate: traversal_node });
		}
		this.register_declaration({ scope: active_scope, candidate: traversal_node });
		traversal_node.forEachChild((child) => this.collect(child, active_scope));
	}

	/** Responsibilities: _async declaration classification_. **/
	private async_callable(node: ts.Declaration): boolean {
		if (!ts.isFunctionLike(node) || !ts.canHaveModifiers(node)) {
			return false;
		}
		const modifiers = ts.getModifiers(node);
		if (modifiers === undefined) {
			return false;
		}
		return modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword);
	}

	/** Responsibilities: _lazy binding index construction_. **/
	private ensure_indexed(): void {
		if (this._indexed_sources.has(this._source_file)) {
			return;
		}
		this._bindings.set(this._source_file, new Map<string, ts.Declaration>());
		this.collect(this._source_file, this._source_file);
		this._indexed_sources.add(this._source_file);
	}

	/** Responsibilities: _Jest binding index initialization_. **/
	public constructor(source_file: ts.SourceFile) {
		this._bindings = new WeakMap<ts.Node, Map<string, ts.Declaration>>();
		this._parent_scopes = new WeakMap<ts.Node, ts.Node>();
		this._node_scopes = new WeakMap<ts.Node, ts.Node>();
		this._source_file = source_file;
		this._indexed_sources = new WeakSet<ts.SourceFile>();
		this._async_declarations = new Set<ts.Declaration>();
	}

	/** Responsibilities: _async declaration invocation_. **/
	public async_call(call: ts.CallExpression): boolean {
		if (!ts.isIdentifier(call.expression)) {
			return false;
		}
		return this.binding_is(call.expression, this._async_declarations);
	}

	/** Responsibilities: _lexical declaration membership resolution_. **/
	public binding_is(identifier: ts.Identifier, declarations: ReadonlySet<ts.Declaration>): boolean {
		this.ensure_indexed();
		let scope = this._node_scopes.get(identifier);
		while (scope !== undefined) {
			const scope_bindings = this._bindings.get(scope);
			if (scope_bindings !== undefined) {
				if (scope_bindings.has(identifier.text)) {
					const declaration = scope_bindings.get(identifier.text);
					return declaration !== undefined && declarations.has(declaration);
				}
			}
			scope = this._parent_scopes.get(scope);
		}
		return false;
	}
}
