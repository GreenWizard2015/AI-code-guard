import ts from "typescript";
import type { LexicalBindingScopeContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _lexical declaration lookup_, _scope ownership_. **/
export class LexicalBindingScope implements LexicalBindingScopeContract {
	private readonly source_file: ts.SourceFile;

	/** Responsibilities: _scope boundary_. **/
	private scope_boundary(node: ts.Node): boolean {
		if (ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node)) {
			return true;
		}
		if (ts.isFunctionLike(node)) {
			return true;
		}
		return ts.isCatchClause(node);
	}

	/** Responsibilities: _lexical scope resolution_. **/
	private lexical_scope(node: ts.Node): ts.Node {
		let current: ts.Node | undefined = node.parent;
		while (current !== undefined) {
			if (this.scope_boundary(current)) {
				return current;
			}
			current = current.parent;
		}
		return this.source_file;
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

	/** Responsibilities: _scope parameter name lookup_. **/
	private scope_parameter_name(scope: ts.Node, name: string, type_name: boolean): boolean {
		if (!ts.isFunctionLike(scope)) {
			return false;
		}
		if (!type_name) {
			const value_parameter = scope.parameters.some((parameter) => this.binding_contains_name(parameter.name, name));
			if (value_parameter) {
				return true;
			}
		}
		const type_parameters = scope.typeParameters;
		if (type_parameters === undefined) {
			return false;
		}
		return type_parameters.some((parameter) => parameter.name.text === name);
	}

	/** Responsibilities: _import binding name lookup_. **/
	private import_clause_name(clause: ts.ImportClause, name: string): boolean {
		if (clause.name?.text === name) {
			return true;
		}
		const bindings = clause.namedBindings;
		if (bindings === undefined) {
			return false;
		}
		if (ts.isNamespaceImport(bindings)) {
			return bindings.name.text === name;
		}
		return bindings.elements.some((specifier) => specifier.name.text === name);
	}

	/** Responsibilities: _import declaration name lookup_. **/
	private import_declaration_name(node: ts.Node, name: string): boolean {
		if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) {
			return false;
		}
		const clause = node.importClause;
		if (clause === undefined) {
			return false;
		}
		return this.import_clause_name(clause, name);
	}

	/** Responsibilities: _type declaration name lookup_. **/
	private type_declaration_name(node: ts.Node, name: string): boolean {
		if (ts.isTypeAliasDeclaration(node) && node.name.text === name) {
			return true;
		}
		if (ts.isInterfaceDeclaration(node) && node.name.text === name) {
			return true;
		}
		if (ts.isClassDeclaration(node) && node.name?.text === name) {
			return true;
		}
		if (ts.isEnumDeclaration(node) && node.name.text === name) {
			return true;
		}
		if (ts.isTypeParameterDeclaration(node) && node.name.text === name) {
			return true;
		}
		return this.import_declaration_name(node, name);
	}

	/** Responsibilities: _value declaration name lookup_. **/
	private value_declaration_name(node: ts.Node, name: string): boolean {
		if ((ts.isVariableDeclaration(node) || ts.isParameter(node)) && this.binding_contains_name(node.name, name)) {
			return true;
		}
		if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
			return true;
		}
		if (ts.isClassDeclaration(node) && node.name?.text === name) {
			return true;
		}
		if (ts.isEnumDeclaration(node) && node.name.text === name) {
			return true;
		}
		return this.import_declaration_name(node, name);
	}

	/** Responsibilities: _scope declaration lookup_. **/
	private scope_declares_name(scope: ts.Node, name: string, type_name: boolean): boolean {
		if (this.scope_parameter_name(scope, name, type_name)) {
			return true;
		}
		let found = false;
		const visit = (node: ts.Node): void => {
			if (found || (node !== scope && this.scope_boundary(node))) {
				return;
			}
			let declares_name = false;
			if (type_name) {
				declares_name = this.type_declaration_name(node, name);
			} else {
				declares_name = this.value_declaration_name(node, name);
			}
			if (declares_name) {
				found = true;
				return;
			}
			ts.forEachChild(node, visit);
		};
		scope.forEachChild(visit);
		return found;
	}

	/** Responsibilities: _lexically shadowed declaration lookup_. **/
	private shadowed_name(node: ts.Node, name: string, type_name: boolean): boolean {
		let scope = this.lexical_scope(node);
		while (true) {
			if (this.scope_declares_name(scope, name, type_name)) {
				return true;
			}
			const parent_scope = this.lexical_scope(scope);
			if (parent_scope === scope) {
				return false;
			}
			scope = parent_scope;
		}
	}

	/** Responsibilities: _lexical source ownership_. **/
	public constructor(source_file: ts.SourceFile) {
		this.source_file = source_file;
	}

	/** Responsibilities: _type name shadowing_. **/
	public type_name_shadowed(node: ts.Node, name: string): boolean {
		return this.shadowed_name(node, name, true);
	}

	/** Responsibilities: _value name shadowing_. **/
	public value_name_shadowed(node: ts.Node, name: string): boolean {
		return this.shadowed_name(node, name, false);
	}
}
