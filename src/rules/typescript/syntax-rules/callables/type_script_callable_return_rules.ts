import ts from "typescript";

/** Responsibilities: _callable parents_, _annotation types_. **/
export class TypeScriptCallableReturnRules {
	private readonly variable_return_kinds: ReadonlySet<ts.SyntaxKind>;

	/** Responsibilities: _callback boundary classification_. **/
	private callback_boundary(child: ts.Node, parent: ts.Node): boolean {
		if (ts.isCallExpression(parent)) {
			return parent.expression !== child;
		}
		if (ts.isNewExpression(parent)) {
			return parent.expression !== child;
		}
		return false;
	}

	/** Responsibilities: _callback result annotation_. **/
	private missing_variable_return(node: ts.FunctionLikeDeclaration): boolean {
		if (!this.variable_return_kinds.has(node.kind)) {
			return false;
		}
		const parent = this.callable_parent(node);
		if (!ts.isVariableDeclaration(parent) || !ts.isIdentifier(parent.name)) {
			return false;
		}
		return parent.type === undefined && node.type === undefined;
	}

	/** Responsibilities: _callback return-kind index_. **/
	public constructor() {
		this.variable_return_kinds = new Set([ts.SyntaxKind.ArrowFunction, ts.SyntaxKind.FunctionExpression]);
	}

	/** Responsibilities: _callable parent resolution_. **/
	public callable_parent(node: ts.FunctionLikeDeclaration): ts.Node {
		let child: ts.Node = node;
		let parent = node.parent;
		while (!ts.isSourceFile(parent)) {
			if (ts.isVariableDeclaration(parent)) {
				return parent;
			}
			if (ts.isFunctionLike(parent)) {
				return parent;
			}
			if (this.callback_boundary(child, parent)) {
				return parent;
			}
			child = parent;
			parent = parent.parent;
		}
		return parent;
	}

	/** Responsibilities: _missing callable annotation_. **/
	public missing(node: ts.SignatureDeclaration): boolean {
		switch (node.kind) {
			case ts.SyntaxKind.FunctionDeclaration:
			case ts.SyntaxKind.MethodDeclaration:
			case ts.SyntaxKind.GetAccessor:
			case ts.SyntaxKind.MethodSignature:
				return node.type === undefined;
			case ts.SyntaxKind.ArrowFunction:
			case ts.SyntaxKind.FunctionExpression:
				if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
					return this.missing_variable_return(node);
				}
				return false;
			default:
				break;
		}
		return false;
	}
}
