import type { RuntimeAliasScopeContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _prototype alias lexical scope_, _declaration shadowing_. **/
export class RuntimeAliasScope implements RuntimeAliasScopeContract {
	private readonly _scope_cache: WeakMap<ts.Node, ts.Node>;

	/** Responsibilities: _lexical scope boundary_. **/
	private boundary(scope_boundary: ts.Node): boolean {
		if (ts.isSourceFile(scope_boundary)) {
			return true;
		}
		if (ts.isBlock(scope_boundary) || ts.isModuleBlock(scope_boundary)) {
			return true;
		}
		if (ts.isIterationStatement(scope_boundary, false) || ts.isCatchClause(scope_boundary)) {
			return true;
		}
		return ts.isFunctionLike(scope_boundary);
	}

	/** Responsibilities: _binding name matching_. **/
	private binding_contains_name(binding: ts.BindingName, binding_target: string): boolean {
		if (ts.isIdentifier(binding)) {
			return binding.text === binding_target;
		}
		return binding.elements.some(
			(element) => !ts.isOmittedExpression(element) && this.binding_contains_name(element.name, binding_target),
		);
	}

	/** Responsibilities: _binding shadow detection_. **/
	private binding_declares(binding_scope: ts.Node, parameter_target: string): boolean {
		if (ts.isFunctionLike(binding_scope)) {
			const has_parameter = binding_scope.parameters.some((parameter) =>
				this.binding_contains_name(parameter.name, parameter_target),
			);
			if (has_parameter) {
				return true;
			}
		}
		if (ts.isCatchClause(binding_scope)) {
			if (binding_scope.variableDeclaration !== undefined) {
				if (this.binding_contains_name(binding_scope.variableDeclaration.name, parameter_target)) {
					return true;
				}
			}
		}
		return false;
	}

	/** Responsibilities: _nested scope declaration search_. **/
	private nested_declares(nested_scope: ts.Node, declaration_target: string): boolean {
		let found = false;
		const visit = (node: ts.Node): void => {
			if (found) {
				return;
			}
			if (node !== nested_scope && this.boundary(node)) {
				return;
			}
			if (this.declaration_name_matches(node, declaration_target)) {
				found = true;
				return;
			}
			ts.forEachChild(node, visit);
		};
		nested_scope.forEachChild(visit);
		return found;
	}

	/** Responsibilities: _scope declaration lookup_. **/
	private scope_declares_name(shadow_scope: ts.Node, shadowed_name: string): boolean {
		if (this.binding_declares(shadow_scope, shadowed_name)) {
			return true;
		}
		return this.nested_declares(shadow_scope, shadowed_name);
	}

	/** Responsibilities: _scope declaration name_. **/
	private declaration_name_matches(declaration_candidate: ts.Node, declared_name: string): boolean {
		if (ts.isVariableDeclaration(declaration_candidate)) {
			return this.binding_contains_name(declaration_candidate.name, declared_name);
		}
		if (ts.isFunctionDeclaration(declaration_candidate) || ts.isClassDeclaration(declaration_candidate)) {
			return declaration_candidate.name?.text === declared_name;
		}
		return false;
	}

	/** Responsibilities: _conditional scope boundary_. **/
	private conditional_boundary(branch_candidate: ts.Node): boolean {
		if (ts.isIfStatement(branch_candidate)) {
			return true;
		}
		if (ts.isConditionalExpression(branch_candidate)) {
			return true;
		}
		if (ts.isSwitchStatement(branch_candidate)) {
			return true;
		}
		if (ts.isIterationStatement(branch_candidate, false) || ts.isCatchClause(branch_candidate)) {
			return true;
		}
		return ts.isFunctionLike(branch_candidate);
	}

	/** Responsibilities: _nearest lexical boundary_. **/
	private nearest_boundary(scope_origin: ts.Node): ts.Node {
		let current = scope_origin.parent;
		while (current !== undefined && !this.boundary(current)) {
			current = current.parent;
		}
		if (current !== undefined) {
			return current;
		}
		return scope_origin.getSourceFile();
	}

	/** Responsibilities: _scope cache initialization_. **/
	public constructor() {
		this._scope_cache = new WeakMap<ts.Node, ts.Node>();
	}

	/** Responsibilities: _node lexical scope_. **/
	public lexical_scope(scope_origin: ts.Node): ts.Node {
		const cached_scope = this._scope_cache.get(scope_origin);
		if (cached_scope !== undefined) {
			return cached_scope;
		}
		const resolved_scope = this.nearest_boundary(scope_origin);
		this._scope_cache.set(scope_origin, resolved_scope);
		return resolved_scope;
	}

	/** Responsibilities: _lexical containment_. **/
	public contains(ancestor_scope: ts.Node, descendant: ts.Node): boolean {
		let current = this.lexical_scope(descendant);
		while (current !== ancestor_scope) {
			const parent_scope = this.lexical_scope(current);
			if (parent_scope === current) {
				return false;
			}
			current = parent_scope;
		}
		return true;
	}

	/** Responsibilities: _conditional assignment context_. **/
	public conditional_write(write_candidate: ts.Node, lexical_scope: ts.Node): boolean {
		let current = write_candidate.parent;
		while (current !== undefined) {
			if (current === lexical_scope) {
				break;
			}
			if (this.conditional_boundary(current)) {
				return true;
			}
			current = current.parent;
		}
		return false;
	}

	/** Responsibilities: _visible prototype alias_. **/
	public visible(alias_declaration: ts.VariableDeclaration, mutation: ts.Node): boolean {
		const declaration_scope = this.lexical_scope(alias_declaration);
		let current = this.lexical_scope(mutation);
		while (current !== declaration_scope) {
			if (this.scope_declares_name(current, alias_declaration.name.getText())) {
				return false;
			}
			const parent_scope = this.lexical_scope(current);
			if (parent_scope === current) {
				return false;
			}
			if (!this.contains(declaration_scope, parent_scope)) {
				return false;
			}
			current = parent_scope;
		}
		return alias_declaration.pos < mutation.pos && this.contains(declaration_scope, mutation);
	}
}
