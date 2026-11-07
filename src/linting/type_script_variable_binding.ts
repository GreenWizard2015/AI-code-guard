import type { PreferredVariableDeclaration } from "src/linting/types";
import { TypeScriptTypeNode } from "src/model/type_script_type_node";
import type {
	TypeScriptTypeNodeContract,
	TypeScriptVariableDeclarationIndexContract,
} from "src/typescript_analysis_protocols";
import type { TypeScriptVariableBindingContract } from "src/typescript_analysis_types";
import type { VisibleVariableDeclarationQuery } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _lexical scope resolution_, _visible declaration lookup_. **/
export class TypeScriptVariableBinding implements TypeScriptVariableBindingContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _type_nodes: Map<ts.TypeNode, TypeScriptTypeNodeContract>;
	private readonly _declaration_index: TypeScriptVariableDeclarationIndexContract;

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

	/** Responsibilities: _resolution cached type wrapper_. **/
	private type_node(node: ts.TypeNode): TypeScriptTypeNodeContract {
		const existing = this._type_nodes.get(node);
		if (existing !== undefined) {
			return existing;
		}
		const type_node = new TypeScriptTypeNode(node);
		this._type_nodes.set(node, type_node);
		return type_node;
	}

	/** Responsibilities: _visible declaration preference_. **/
	private declaration_preferred(
		current: ts.Node,
		candidate: ts.VariableDeclaration,
		scope_index: number,
		selected_scope: number,
	): boolean {
		if (scope_index < selected_scope) {
			return true;
		}
		if (scope_index !== selected_scope || !ts.isVariableDeclaration(current)) {
			return false;
		}
		return candidate.pos > current.pos;
	}

	/** Responsibilities: _nearest visible variable declaration_. **/
	private nearest_declaration(input: VisibleVariableDeclarationQuery): ts.Node {
		let selected: ts.Node = this._source_file;
		let selected_scope = input.scopes.length;
		for (const candidate of input.declarations) {
			const match = this.preferred_declaration(input, selected, selected_scope, candidate);
			if (match.found) {
				selected = match.declaration;
				selected_scope = match.scope_index;
			}
		}
		return selected;
	}

	/** Responsibilities: _visible declaration candidate selection_. **/
	private preferred_declaration(
		input: VisibleVariableDeclarationQuery,
		selected: ts.Node,
		selected_scope: number,
		candidate: ts.VariableDeclaration,
	): PreferredVariableDeclaration {
		if (candidate.pos > input.reference.pos) {
			return { found: false, declaration: selected, scope_index: selected_scope };
		}
		const scope_index = input.scopes.indexOf(this.declaration_scope(candidate));
		if (scope_index < 0 || scope_index > selected_scope) {
			return { found: false, declaration: selected, scope_index: selected_scope };
		}
		if (!this.declaration_preferred(selected, candidate, scope_index, selected_scope)) {
			return { found: false, declaration: selected, scope_index: selected_scope };
		}
		return { found: true, declaration: candidate, scope_index };
	}

	/** Responsibilities: _initialization source variable bindings_. **/
	public constructor(source_file: ts.SourceFile, declaration_index: TypeScriptVariableDeclarationIndexContract) {
		this._type_nodes = new Map<ts.TypeNode, TypeScriptTypeNodeContract>();
		this._declaration_index = declaration_index;
		this._source_file = source_file;
	}

	/** Responsibilities: _exposure visible variable declaration_. **/
	public declaration(name: string, reference: ts.Node): ts.Node {
		const declarations = this._declaration_index.declarations(this._source_file, name);
		const scopes = this.scope_chain(reference);
		return this.nearest_declaration({ declarations, scopes, reference });
	}

	/** Responsibilities: _classification visible primitive binding_. **/
	public primitive(name: string, reference: ts.Node): boolean {
		if (!this._declaration_index.declarations_present(this._source_file, name)) {
			return false;
		}
		const declaration = this.declaration(name, reference);
		if (!ts.isVariableDeclaration(declaration)) {
			return false;
		}
		if (declaration.type === undefined) {
			return false;
		}
		return this.type_node(declaration.type).primitive();
	}
}
