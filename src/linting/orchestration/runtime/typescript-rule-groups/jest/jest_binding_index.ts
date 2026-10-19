import ts from "typescript";
import type { JestNodeScopes, JestScopeBindingMaps, JestScopeParents } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/types";
import type { JestBindingIndexContract } from "src/protocols";

/** Responsibilities: _Jest lexical declaration identity_, _scope shadow resolution_. **/
export class JestBindingIndex implements JestBindingIndexContract {
	private readonly bindings: JestScopeBindingMaps;
	private readonly parent_scopes: JestScopeParents;
	private readonly node_scopes: JestNodeScopes;
	private readonly source_file: ts.SourceFile;
	private readonly indexed_sources: WeakSet<ts.SourceFile>;

	/** Responsibilities: _lexical scope boundary selection_. **/
	private scope_boundary(node: ts.Node, inherited_scope: ts.Node): ts.Node {
		if (node === this.source_file) {
			return inherited_scope;
		}
		if (ts.isBlock(node) || ts.isFunctionLike(node)) {
			return node;
		}
		return inherited_scope;
	}

	/** Responsibilities: _scope binding registration_. **/
	private register(scope: ts.Node, name: string, declaration: ts.Declaration): void {
		let bindings = this.bindings.get(scope);
		if (bindings === undefined) {
			bindings = new Map<string, ts.Declaration>();
			this.bindings.set(scope, bindings);
		}
		if (!bindings.has(name)) {
			bindings.set(name, declaration);
		}
	}

	/** Responsibilities: _declaration name registration_. **/
	private register_declaration(scope: ts.Node, node: ts.Node): void {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
			this.register(scope, node.name.text, node);
			return;
		}
		if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
			this.register(scope, node.name.text, node);
			return;
		}
		if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name !== undefined) {
			this.register(scope, node.name.text, node);
		}
	}

	/** Responsibilities: _scope binding collection_. **/
	private collect(node: ts.Node, inherited_scope: ts.Node): void {
		const active_scope = this.scope_boundary(node, inherited_scope);
		const has_new_scope = active_scope !== inherited_scope;
		if (has_new_scope) {
			this.bindings.set(active_scope, new Map<string, ts.Declaration>());
			this.parent_scopes.set(active_scope, inherited_scope);
		}
		this.node_scopes.set(node, active_scope);
		if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
			this.register_declaration(inherited_scope, node);
		}
		this.register_declaration(active_scope, node);
		node.forEachChild((child) => this.collect(child, active_scope));
	}

	/** Responsibilities: _async declaration classification_. **/
	private async_callable(node: ts.Declaration): boolean {
		if (!ts.isFunctionLike(node) || !ts.canHaveModifiers(node)) {
			return false;
		}
		const modifiers = ts.getModifiers(node);
		return modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) === true;
	}

	/** Responsibilities: _lazy binding index construction_. **/
	private ensure_indexed(): void {
		if (this.indexed_sources.has(this.source_file)) {
			return;
		}
		this.bindings.set(this.source_file, new Map<string, ts.Declaration>());
		this.collect(this.source_file, this.source_file);
		this.indexed_sources.add(this.source_file);
	}

	/** Responsibilities: _Jest binding index initialization_. **/
	public constructor(source_file: ts.SourceFile) {
		this.bindings = new WeakMap<ts.Node, Map<string, ts.Declaration>>();
		this.parent_scopes = new WeakMap<ts.Node, ts.Node>();
		this.node_scopes = new WeakMap<ts.Node, ts.Node>();
		this.source_file = source_file;
		this.indexed_sources = new WeakSet<ts.SourceFile>();
	}

	/** Responsibilities: _identifier declaration membership_. **/
	public module_binding(identifier: ts.Identifier, declarations: ReadonlySet<ts.Declaration>): boolean {
		this.ensure_indexed();
		let scope = this.node_scopes.get(identifier);
		while (scope !== undefined) {
			const declaration = this.bindings.get(scope)?.get(identifier.text);
			if (declaration !== undefined) {
				return declarations.has(declaration);
			}
			scope = this.parent_scopes.get(scope);
		}
		return false;
	}

	/** Responsibilities: _async binding classification_. **/
	public async_binding(identifier: ts.Identifier): boolean {
		this.ensure_indexed();
		let scope = this.node_scopes.get(identifier);
		while (scope !== undefined) {
			const declaration = this.bindings.get(scope)?.get(identifier.text);
			if (declaration !== undefined) {
				return this.async_callable(declaration);
			}
			scope = this.parent_scopes.get(scope);
		}
		return false;
	}

}
