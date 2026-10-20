import type { RuntimeAliasScopeContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _prototype alias lexical scope_, _declaration shadowing_. **/
export class PrototypeAliasScope implements RuntimeAliasScopeContract {
	private readonly scope_cache: WeakMap<ts.Node, ts.Node>;

	/** Responsibilities: _lexical scope boundary_. **/
	private boundary(node: ts.Node): boolean {
		if (ts.isSourceFile(node)) {
			return true;
		}
		if (ts.isBlock(node) || ts.isModuleBlock(node)) {
			return true;
		}
		if (ts.isIterationStatement(node, false) || ts.isCatchClause(node)) {
			return true;
		}
		return ts.isFunctionLike(node);
	}

	/** Responsibilities: _binding name matching_. **/
	private binding_contains_name(binding: ts.BindingName, name: string): boolean {
		if (ts.isIdentifier(binding)) {
			return binding.text === name;
		}
		return binding.elements.some(
			(element) => !ts.isOmittedExpression(element) && this.binding_contains_name(element.name, name),
		);
	}

	/** Responsibilities: _binding shadow detection_. **/
	private binding_declares(scope: ts.Node, name: string): boolean {
		if (ts.isFunctionLike(scope)) {
			const has_parameter = scope.parameters.some((parameter) => this.binding_contains_name(parameter.name, name));
			if (has_parameter) {
				return true;
			}
		}
		if (ts.isCatchClause(scope) && scope.variableDeclaration !== undefined) {
			if (this.binding_contains_name(scope.variableDeclaration.name, name)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _nested scope declaration search_. **/
	private nested_declares(scope: ts.Node, name: string): boolean {
		let found = false;
		const visit = (node: ts.Node): void => {
			if (found) {
				return;
			}
			if (node !== scope && this.boundary(node)) {
				return;
			}
			if (this.declaration_name_matches(node, name)) {
				found = true;
				return;
			}
			ts.forEachChild(node, visit);
		};
		scope.forEachChild(visit);
		return found;
	}

	/** Responsibilities: _scope declaration lookup_. **/
	private scope_declares_name(scope: ts.Node, name: string): boolean {
		if (this.binding_declares(scope, name)) {
			return true;
		}
		return this.nested_declares(scope, name);
	}

	/** Responsibilities: _scope declaration name_. **/
	private declaration_name_matches(node: ts.Node, name: string): boolean {
		if (ts.isVariableDeclaration(node)) {
			return this.binding_contains_name(node.name, name);
		}
		if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
			return node.name?.text === name;
		}
		return false;
	}

	/** Responsibilities: _conditional scope boundary_. **/
	private conditional_boundary(node: ts.Node): boolean {
		if (ts.isIfStatement(node) || ts.isConditionalExpression(node) || ts.isSwitchStatement(node)) {
			return true;
		}
		if (ts.isIterationStatement(node, false) || ts.isCatchClause(node)) {
			return true;
		}
		return ts.isFunctionLike(node);
	}

	/** Responsibilities: _scope cache initialization_. **/
	public constructor() {
		this.scope_cache = new WeakMap<ts.Node, ts.Node>();
	}

	/** Responsibilities: _node lexical scope_. **/
	public lexical_scope(node: ts.Node): ts.Node {
		const cached_scope = this.scope_cache.get(node);
		if (cached_scope !== undefined) {
			return cached_scope;
		}
		let current = node.parent;
		while (current !== undefined && !this.boundary(current)) {
			current = current.parent;
		}
		let resolved_scope: ts.Node = node.getSourceFile();
		if (current !== undefined) {
			resolved_scope = current;
		}
		this.scope_cache.set(node, resolved_scope);
		return resolved_scope;
	}

	/** Responsibilities: _lexical containment_. **/
	public contains(scope: ts.Node, node: ts.Node): boolean {
		let current = this.lexical_scope(node);
		while (current !== scope) {
			const parent_scope = this.lexical_scope(current);
			if (parent_scope === current) {
				return false;
			}
			current = parent_scope;
		}
		return true;
	}

	/** Responsibilities: _conditional assignment context_. **/
	public conditional_write(node: ts.Node, scope: ts.Node): boolean {
		let current = node.parent;
		while (current !== undefined && current !== scope) {
			if (this.conditional_boundary(current)) {
				return true;
			}
			current = current.parent;
		}
		return false;
	}

	/** Responsibilities: _visible prototype alias_. **/
	public visible(declaration: ts.VariableDeclaration, mutation: ts.Node): boolean {
		const declaration_scope = this.lexical_scope(declaration);
		let current = this.lexical_scope(mutation);
		while (current !== declaration_scope) {
			if (this.scope_declares_name(current, declaration.name.getText())) {
				return false;
			}
			const parent_scope = this.lexical_scope(current);
			if (parent_scope === current || !this.contains(declaration_scope, parent_scope)) {
				return false;
			}
			current = parent_scope;
		}
		return declaration.pos < mutation.pos && this.contains(declaration_scope, mutation);
	}
}
