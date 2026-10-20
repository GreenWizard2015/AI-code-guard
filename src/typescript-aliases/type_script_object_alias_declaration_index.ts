import ts from "typescript";
import type {
	TypeScriptObjectAliasDeclarationAppender,
	TypeScriptObjectAliasDeclarationIndexContract,
} from "src/typescript_runtime_protocols";

/** Responsibilities: _scope declaration inventory_, _AST-scoped declaration reuse_. **/
export class TypeScriptObjectAliasDeclarationIndex implements TypeScriptObjectAliasDeclarationIndexContract {
	private readonly declarations_by_scope: WeakMap<ts.Node, readonly ts.Node[]>;

	/** Responsibilities: _scope declaration collection_. **/
	private collect_declarations(node: ts.Node, root: ts.Node, declarations: ts.Node[]): void {
		if (node !== root && ts.isFunctionLike(node)) {
			return;
		}
		if (ts.isVariableDeclaration(node) || ts.isBinaryExpression(node)) {
			declarations.push(node);
		}
		node.forEachChild((child) => this.collect_declarations(child, root, declarations));
	}

	/** Responsibilities: _declaration index initialization_. **/
	public constructor() {
		this.declarations_by_scope = new WeakMap();
	}

	/** Responsibilities: _scope declaration lookup_. **/
	public declarations(scope: ts.Node): readonly ts.Node[] {
		const cached = this.declarations_by_scope.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const declarations: ts.Node[] = [];
		this.collect_declarations(scope, scope, declarations);
		this.declarations_by_scope.set(scope, declarations);
		return declarations;
	}

	/** Responsibilities: _scope declaration application_. **/
	public append(scope: ts.Node, append_declaration: TypeScriptObjectAliasDeclarationAppender): boolean {
		let changed = false;
		for (const declaration of this.declarations(scope)) {
			if (append_declaration(declaration)) {
				changed = true;
			}
		}
		return changed;
	}
}
