import ts from 'typescript';
import { TypeScriptTypeNode } from 'src/model/typescript-type-node';

/** Responsibilities: _resolution lexical variable bindings_. **/
export class TypeScriptVariableBinding {
	private readonly source_file: ts.SourceFile;
	private readonly type_nodes = new Map<ts.TypeNode, TypeScriptTypeNode>();

	/** Responsibilities: _classification lexical scope nodes_. **/
	private is_scope(node: ts.Node): boolean {
		if (ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node)) {
			return true;
		}
		if (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) {
			return true;
		}
		return ts.isCaseBlock(node);
	}

	/** Responsibilities: _resolution declaration scope_. **/
	private declaration_scope(node: ts.VariableDeclaration): ts.Node {
		let current: ts.Node = node.parent;
		while (!this.is_scope(current) && !ts.isSourceFile(current)) {
			current = current.parent;
		}
		return current;
	}

	/** Responsibilities: _collection reference scope chain_. **/
	private scope_chain(node: ts.Node): ts.Node[] {
		const scopes: ts.Node[] = [];
		let current: ts.Node | undefined = node;
		while (current !== undefined) {
			if (this.is_scope(current)) {
				scopes.push(current);
			}
			if (ts.isSourceFile(current)) {
				break;
			}
			current = current.parent;
		}
		return scopes;
	}

	/** Responsibilities: _collection named variable declarations_. **/
	private declarations(source_file: ts.SourceFile, name: string): ts.VariableDeclaration[] {
		const result: ts.VariableDeclaration[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
				result.push(node);
			}
			ts.forEachChild(node, visit);
		};
		visit(source_file);
		return result;
	}

	/** Responsibilities: _selection eligible declaration scope_. **/
	private candidate_scope(
		declaration: ts.VariableDeclaration,
		scopes: readonly ts.Node[],
		reference: ts.Node
	): number {
		if (declaration.pos > reference.pos) {
			return -1;
		}
		return scopes.indexOf(this.declaration_scope(declaration));
	}

	/** Responsibilities: _selection preferred visible declaration_. **/
	private prefers(
		declaration: ts.VariableDeclaration,
		scope_index: number,
		selected: ts.Node,
		selected_scope: number
	): boolean {
		if (scope_index < selected_scope) {
			return true;
		}
		return !ts.isVariableDeclaration(selected) || declaration.pos > selected.pos;
	}

	/** Responsibilities: _selection visible variable declaration_. **/
	private visible_declaration(
		declarations: readonly ts.VariableDeclaration[],
		scopes: readonly ts.Node[],
		reference: ts.Node
	): ts.Node {
		let selected: ts.Node = this.source_file;
		let selected_scope = scopes.length;
		for (const declaration of declarations) {
			const scope_index = this.candidate_scope(declaration, scopes, reference);
			if (scope_index < 0 || scope_index > selected_scope) {
				continue;
			}
			if (this.prefers(declaration, scope_index, selected, selected_scope)) {
				selected = declaration;
				selected_scope = scope_index;
			}
		}
		return selected;
	}

	/** Responsibilities: _resolution cached type wrapper_. **/
	private type_node(node: ts.TypeNode): TypeScriptTypeNode {
		const existing = this.type_nodes.get(node);
		if (existing !== undefined) {
			return existing;
		}
		const type_node = new TypeScriptTypeNode(node);
		this.type_nodes.set(node, type_node);
		return type_node;
	}

	/** Responsibilities: _initialization source variable bindings_. **/
	public constructor(source_file: ts.SourceFile) {
		this.source_file = source_file;
	}

	/** Responsibilities: _exposure visible variable declaration_. **/
	public declaration(
		name: string,
		reference: ts.Node
	): ts.Node {
		return this.visible_declaration(
			this.declarations(this.source_file, name),
			this.scope_chain(reference),
			reference
		);
	}

	/** Responsibilities: _classification visible primitive binding_. **/
	public primitive(name: string, reference: ts.Node): boolean {
		const declaration = this.declaration(name, reference);
		if (!ts.isVariableDeclaration(declaration) || declaration.type === undefined) {
			return false;
		}
		return this.type_node(declaration.type).primitive();
	}
}
