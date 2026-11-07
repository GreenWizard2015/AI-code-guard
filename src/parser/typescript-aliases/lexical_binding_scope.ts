import type {
	LexicalBindingScopeContract,
	LexicalDeclarationNameQuery,
	LexicalScopedNameQuery,
	LexicalShadowedNameQuery,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _lexical declaration lookup_, _scope ownership_. **/
export class LexicalBindingScope implements LexicalBindingScopeContract {
	private readonly _source_file: ts.SourceFile;

	/** Responsibilities: _binding name matching_. **/
	private binding_contains_name(binding: ts.BindingName, binding_name: string): boolean {
		if (ts.isIdentifier(binding)) {
			return binding.text === binding_name;
		}
		return binding.elements.some(
			(element) => !ts.isOmittedExpression(element) && this.binding_contains_name(element.name, binding_name),
		);
	}

	/** Responsibilities: _named import binding lookup_. **/
	private import_binding_name(bindings: ts.NamedImportBindings, binding_name: string): boolean {
		if (ts.isNamespaceImport(bindings)) {
			return bindings.name.text === binding_name;
		}
		return bindings.elements.some((specifier) => specifier.name.text === binding_name);
	}

	/** Responsibilities: _import clause name lookup_. **/
	private import_clause_name(clause: ts.ImportClause, clause_name: string): boolean {
		if (clause.name?.text === clause_name) {
			return true;
		}
		const bindings = clause.namedBindings;
		if (bindings === undefined) {
			return false;
		}
		return this.import_binding_name(bindings, clause_name);
	}

	/** Responsibilities: _import declaration name lookup_. **/
	private import_declaration_name(query: LexicalDeclarationNameQuery): boolean {
		const { node, name } = query;
		if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) {
			return false;
		}
		const clause = node.importClause;
		if (clause === undefined) {
			return false;
		}
		return this.import_clause_name(clause, name);
	}

	/** Responsibilities: _lexical scope boundary classification_. **/
	private scope_boundary(scope_node: ts.Node): boolean {
		switch (scope_node.kind) {
			case ts.SyntaxKind.SourceFile:
			case ts.SyntaxKind.Block:
			case ts.SyntaxKind.ModuleBlock:
			case ts.SyntaxKind.CatchClause:
				return true;
			default:
				return ts.isFunctionLike(scope_node);
		}
	}

	/** Responsibilities: _nearest lexical scope_. **/
	private nearest_scope(start_node: ts.Node, move_outward = false): ts.Node {
		let current = start_node;
		if (move_outward) {
			const parent = current.parent;
			if (parent === undefined) {
				return current;
			}
			current = parent;
		}
		while (!this.scope_boundary(current)) {
			const parent = current.parent;
			if (parent === undefined) {
				return this._source_file;
			}
			current = parent;
		}
		return current;
	}

	/** Responsibilities: _scope declaration lookup_. **/
	private scope_declares_name(query: LexicalScopedNameQuery): boolean {
		const scope = query.scope;
		if (this.function_parameters_declare(scope, query.name, query.type_name)) {
			return true;
		}
		let found = false;
		scope.forEachChild((child) => {
			if (!found) {
				found = this.declaration_in_scope(child, query);
			}
		});
		return found;
	}

	/** Responsibilities: _function scope parameter lookup_. **/
	private function_parameters_declare(scope: ts.Node, function_parameter_name: string, type_name: boolean): boolean {
		if (!ts.isFunctionLike(scope)) {
			return false;
		}
		const parameter_matches = scope.parameters.some(
			(parameter) => !type_name && this.binding_contains_name(parameter.name, function_parameter_name),
		);
		const type_parameters = scope.typeParameters;
		if (type_parameters === undefined) {
			return parameter_matches;
		}
		return parameter_matches || type_parameters.some((parameter) => parameter.name.text === function_parameter_name);
	}

	/** Responsibilities: _scope subtree declaration lookup_. **/
	private declaration_in_scope(declaration_node: ts.Node, query: LexicalScopedNameQuery): boolean {
		if (declaration_node !== query.scope && this.scope_boundary(declaration_node)) {
			return false;
		}
		if (this.declaration_name({ node: declaration_node, name: query.name, type_name: query.type_name })) {
			return true;
		}
		let found = false;
		declaration_node.forEachChild((child) => {
			if (!found) {
				found = this.declaration_in_scope(child, query);
			}
		});
		return found;
	}

	/** Responsibilities: _type declaration name matching_. **/
	private type_declaration_name(type_declaration: ts.Node, type_name: string): boolean {
		if (ts.isTypeAliasDeclaration(type_declaration)) {
			return type_declaration.name.text === type_name;
		}
		if (ts.isInterfaceDeclaration(type_declaration)) {
			return type_declaration.name.text === type_name;
		}
		if (ts.isTypeParameterDeclaration(type_declaration)) {
			return type_declaration.name.text === type_name;
		}
		return false;
	}

	/** Responsibilities: _value declaration name matching_. **/
	private value_declaration_name(value_declaration: ts.Node, value_name: string): boolean {
		if (ts.isVariableDeclaration(value_declaration) || ts.isParameter(value_declaration)) {
			return this.binding_contains_name(value_declaration.name, value_name);
		}
		return ts.isFunctionDeclaration(value_declaration) && value_declaration.name?.text === value_name;
	}

	/** Responsibilities: _shared declaration name matching_. **/
	private shared_declaration_name(node: ts.Node, declaration_name: string): boolean {
		if (ts.isClassDeclaration(node)) {
			return node.name?.text === declaration_name;
		}
		if (ts.isEnumDeclaration(node)) {
			return node.name.text === declaration_name;
		}
		return ts.isImportDeclaration(node) && this.import_declaration_name({ node, name: declaration_name });
	}

	/** Responsibilities: _scoped declaration name lookup_. **/
	private declaration_name(query: LexicalShadowedNameQuery): boolean {
		if (query.type_name) {
			return this.type_declaration_name(query.node, query.name);
		}
		if (this.value_declaration_name(query.node, query.name)) {
			return true;
		}
		return this.shared_declaration_name(query.node, query.name);
	}

	/** Responsibilities: _lexically shadowed declaration lookup_. **/
	private shadowed_name(query: LexicalShadowedNameQuery): boolean {
		let scope = this.nearest_scope(query.node);
		while (true) {
			if (this.scope_declares_name({ scope, name: query.name, type_name: query.type_name })) {
				return true;
			}
			const next_scope = this.nearest_scope(scope, true);
			if (next_scope === scope) {
				return false;
			}
			scope = next_scope;
		}
	}

	/** Responsibilities: _lexical source ownership_. **/
	public constructor(source_file: ts.SourceFile) {
		this._source_file = source_file;
	}

	/** Responsibilities: _type name shadowing_. **/
	public type_name_shadowed(type_reference: ts.Node, name: string): boolean {
		return this.shadowed_name({ node: type_reference, name, type_name: true });
	}

	/** Responsibilities: _value name shadowing_. **/
	public value_name_shadowed(value_reference: ts.Node, name: string): boolean {
		return this.shadowed_name({ node: value_reference, name, type_name: false });
	}
}
