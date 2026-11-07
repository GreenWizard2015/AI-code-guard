import type { TypeScriptVariableDeclarationScopeContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _full variable declaration inventory_, _member-boundary variable declaration inventory_. **/
export class TypeScriptVariableDeclarationScope implements TypeScriptVariableDeclarationScopeContract {
	private readonly _root: ts.Node;
	private readonly _declarations_by_kind: Map<string, readonly ts.VariableDeclaration[]>;

	/** Responsibilities: _complete variable declaration collection_. **/
	private append_all(node: ts.Node, declarations: ts.VariableDeclaration[]): void {
		if (ts.isVariableDeclaration(node)) {
			declarations.push(node);
		}
		node.forEachChild((child) => this.append_all(child, declarations));
	}

	/** Responsibilities: _scope member variable collection_. **/
	private collect_members(): readonly ts.VariableDeclaration[] {
		const declarations: ts.VariableDeclaration[] = [];
		const pending = [this._root];
		while (pending.length > 0) {
			const node = pending.pop();
			if (node === undefined || (node !== this._root && ts.isFunctionLike(node))) {
				continue;
			}
			if (ts.isVariableDeclaration(node)) {
				declarations.push(node);
			}
			node.forEachChild((child) => {
				pending.push(child);
			});
		}
		declarations.reverse();
		return declarations;
	}

	/** Responsibilities: _variable declaration scope initialization_. **/
	public constructor(root: ts.Node) {
		this._root = root;
		this._declarations_by_kind = new Map<string, readonly ts.VariableDeclaration[]>();
	}

	/** Responsibilities: _complete variable declaration lookup_. **/
	public all_variable_declarations(): readonly ts.VariableDeclaration[] {
		const cached = this._declarations_by_kind.get("all");
		if (cached !== undefined) {
			return cached;
		}
		const declarations: ts.VariableDeclaration[] = [];
		this.append_all(this._root, declarations);
		this._declarations_by_kind.set("all", declarations);
		return declarations;
	}

	/** Responsibilities: _member variable declaration lookup_. **/
	public member_variable_declarations(): readonly ts.VariableDeclaration[] {
		const cached = this._declarations_by_kind.get("members");
		if (cached !== undefined) {
			return cached;
		}
		const declarations = this.collect_members();
		this._declarations_by_kind.set("members", declarations);
		return declarations;
	}
}
