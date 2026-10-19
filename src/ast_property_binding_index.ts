import ts from "typescript";
import type { AstPropertyBindingIndexContract } from "src/protocols";

/** Responsibilities: _typed lexical binding indexing_, _alias ownership tracking_. **/
export class AstPropertyBindingIndex implements AstPropertyBindingIndexContract {
	private readonly binding_types: Map<string, ts.TypeNode>;
	private readonly binding_aliases: Map<string, string>;

	/** Responsibilities: _scope classification_. **/
	private is_scope(node: ts.Node): boolean {
		if (ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node)) {
			return true;
		}
		return ts.isFunctionLike(node);
	}

	/** Responsibilities: _declaration scope resolution_. **/
	private declaration_scope(node: ts.Node): ts.Node {
		let current = node.parent;
		while (current !== undefined) {
			if (this.is_scope(current)) {
				return current;
			}
			current = current.parent;
		}
		return node.getSourceFile();
	}

	/** Responsibilities: _lexical scope enumeration_. **/
	private scopes(node: ts.Node): ts.Node[] {
		const scopes: ts.Node[] = [];
		let current: ts.Node | undefined = node.parent;
		while (current !== undefined) {
			if (this.is_scope(current)) {
				scopes.push(current);
			}
			current = current.parent;
		}
		return scopes;
	}

	/** Responsibilities: _binding identity creation_. **/
	private key(file: string, scope: ts.Node, name: string): string {
		const scope_start = scope.pos;
		const scope_end = scope.end;
		const binding_name = name;
		return `${file}\u0000${scope_start}\u0000${scope_end}\u0000${binding_name}`;
	}

	/** Responsibilities: _typed binding registration_. **/
	private register_typed_identifier(source: ts.SourceFile, identifier: ts.Identifier, type: ts.TypeNode): void {
		const scope = this.declaration_scope(identifier);
		const key = this.key(source.fileName, scope, identifier.text);
		this.binding_types.set(key, type);
	}

	/** Responsibilities: _binding alias registration_. **/
	private register_identifier_alias(source: ts.SourceFile, identifier: ts.Identifier): void {
		const scope = this.declaration_scope(identifier);
		const key = this.key(source.fileName, scope, identifier.text);
		const declaration = identifier.parent;
		if (!ts.isVariableDeclaration(declaration)) {
			return;
		}
		const initializer = declaration.initializer;
		if (initializer === undefined) {
			return;
		}
		if (!ts.isIdentifier(initializer)) {
			return;
		}
		this.binding_aliases.set(key, initializer.text);
	}

	/** Responsibilities: _binding alias reset_. **/
	private clear_identifier_alias(source: ts.SourceFile, identifier: ts.Identifier): void {
		const scope = this.declaration_scope(identifier);
		const key = this.key(source.fileName, scope, identifier.text);
		this.binding_aliases.delete(key);
	}

	/** Responsibilities: _binding lookup_. **/
	private lookup(file: string, identifier: ts.Identifier): string {
		for (const scope of this.scopes(identifier)) {
			const key = this.key(file, scope, identifier.text);
			if (this.binding_types.has(key) || this.binding_aliases.has(key)) {
				return key;
			}
		}
		return "";
	}

	/** Responsibilities: _binding type lookup_. **/
	private alias_key(key: string): string {
		const alias = this.binding_aliases.get(key);
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
			const type = this.binding_types.get(current);
			if (type !== undefined) {
				return type;
			}
			current = this.alias_key(current);
		}
		return unknown_type;
	}

	/** Responsibilities: _lexical binding type resolution_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.binding_types = new Map<string, ts.TypeNode>();
		this.binding_aliases = new Map<string, string>();
	}
	/** Responsibilities: _public operation_. **/
	public type(identifier: ts.Identifier, unknown_type: ts.TypeNode): ts.TypeNode {
		const file = identifier.getSourceFile().fileName;
		const key = this.lookup(file, identifier);
		return this.resolve_type(key, unknown_type);
	}

	/** Responsibilities: _node binding registration_. **/
	public register(source: ts.SourceFile, node: ts.Node): void {
		if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
			if (node.type !== undefined) {
				this.register_typed_identifier(source, node.name, node.type);
			}
		}
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
			if (node.type !== undefined) {
				this.register_typed_identifier(source, node.name, node.type);
			}
			this.register_identifier_alias(source, node.name);
			const initializer = node.initializer;
			if (initializer !== undefined) {
				if (!ts.isIdentifier(initializer)) {
					this.clear_identifier_alias(source, node.name);
				}
			}
		}
	}
}
