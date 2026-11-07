import type { AstPropertyBindingIndexContract } from "src/source_protocols";
import ts from "typescript";

/** Responsibilities: _typed lexical binding indexing_, _alias ownership tracking_. **/
export class AstPropertyBindingIndex implements AstPropertyBindingIndexContract {
	private readonly _binding_types: Map<string, ts.TypeNode>;
	private readonly _binding_aliases: Map<string, string>;

	/** Responsibilities: _scope classification_. **/
	private is_scope(scope_candidate: ts.Node): boolean {
		if (ts.isSourceFile(scope_candidate) || ts.isBlock(scope_candidate) || ts.isModuleBlock(scope_candidate)) {
			return true;
		}
		return ts.isFunctionLike(scope_candidate);
	}

	/** Responsibilities: _declaration scope resolution_. **/
	private declaration_scope(declaration_node: ts.Node): ts.Node {
		let current = declaration_node.parent;
		while (current !== undefined) {
			if (this.is_scope(current)) {
				return current;
			}
			current = current.parent;
		}
		return declaration_node.getSourceFile();
	}

	/** Responsibilities: _lexical scope enumeration_. **/
	private scopes(usage_node: ts.Node): ts.Node[] {
		const scopes: ts.Node[] = [];
		let current: ts.Node | undefined = usage_node.parent;
		while (current !== undefined) {
			if (this.is_scope(current)) {
				scopes.push(current);
			}
			current = current.parent;
		}
		return scopes;
	}

	/** Responsibilities: _binding identity creation_. **/
	private key(scope: ts.Node, name: string): string {
		const file = scope.getSourceFile().fileName;
		const scope_start = scope.pos;
		const scope_end = scope.end;
		const binding_name = name;
		return `${file}\u0000${scope_start}\u0000${scope_end}\u0000${binding_name}`;
	}

	/** Responsibilities: _parameter type indexing_. **/
	private register_parameter(declaration: ts.ParameterDeclaration): void {
		if (!ts.isIdentifier(declaration.name)) {
			return;
		}
		const identifier = declaration.name;
		const key = this.key(this.declaration_scope(identifier), identifier.text);
		if (declaration.type !== undefined) {
			this._binding_types.set(key, declaration.type);
		}
	}

	/** Responsibilities: _variable binding registration_. **/
	private register_variable(declaration: ts.VariableDeclaration): void {
		if (!ts.isIdentifier(declaration.name)) {
			return;
		}
		const key = this.key(this.declaration_scope(declaration.name), declaration.name.text);
		if (declaration.type !== undefined) {
			this._binding_types.set(key, declaration.type);
		}
		if (declaration.initializer === undefined) {
			return;
		}
		if (ts.isIdentifier(declaration.initializer)) {
			this._binding_aliases.set(key, declaration.initializer.text);
			return;
		}
		this._binding_aliases.delete(key);
	}

	/** Responsibilities: _binding lookup_. **/
	private lookup(identifier: ts.Identifier): string {
		for (const scope of this.scopes(identifier)) {
			const key = this.key(scope, identifier.text);
			if (this._binding_types.has(key) || this._binding_aliases.has(key)) {
				return key;
			}
		}
		return "";
	}

	/** Responsibilities: _binding type lookup_. **/
	private alias_key(key: string): string {
		const alias = this._binding_aliases.get(key);
		if (alias === undefined) {
			return "";
		}
		const separator = key.lastIndexOf("\u0000");
		const scope_key = key.slice(0, separator);
		return `${scope_key}\u0000${alias}`;
	}

	/** Responsibilities: _binding type lookup_. **/
	private resolve_type(key: string, unknown_type: ts.TypeNode): ts.TypeNode {
		let current = key;
		const seen = new Set<string>();
		while (current.length > 0) {
			if (seen.has(current)) {
				break;
			}
			seen.add(current);
			const type = this._binding_types.get(current);
			if (type !== undefined) {
				return type;
			}
			current = this.alias_key(current);
		}
		return unknown_type;
	}

	/** Responsibilities: _lexical binding type resolution_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor() {
		this._binding_types = new Map<string, ts.TypeNode>();
		this._binding_aliases = new Map<string, string>();
	}
	/** Responsibilities: _public operation_. **/
	public type(identifier: ts.Identifier, unknown_type: ts.TypeNode): ts.TypeNode {
		const key = this.lookup(identifier);
		return this.resolve_type(key, unknown_type);
	}

	/** Responsibilities: _node binding registration_. **/
	public register(source: ts.SourceFile, syntax_node: ts.Node): void {
		if (syntax_node.getSourceFile() !== source) {
			return;
		}
		if (ts.isParameter(syntax_node)) {
			this.register_parameter(syntax_node);
			return;
		}
		if (ts.isVariableDeclaration(syntax_node)) {
			this.register_variable(syntax_node);
		}
	}
}
