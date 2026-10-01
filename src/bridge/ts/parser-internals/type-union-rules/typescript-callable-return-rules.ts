import ts from "typescript";

/** Responsibilities: _callable type rules_. **/
export class TypeScriptCallableReturnRules {
	private readonly callable_kinds = new Set([ts.SyntaxKind.ArrowFunction, ts.SyntaxKind.FunctionExpression]);

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

	/** Responsibilities: _callable variable parent resolution_. **/
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
	public missing(node: ts.FunctionLikeDeclaration): boolean {
		if (!this.callable_kinds.has(node.kind)) {
			return false;
		}
		const parent = this.callable_parent(node);
		if (!ts.isVariableDeclaration(parent)) {
			return false;
		}
		if (!ts.isIdentifier(parent.name)) {
			return false;
		}
		if (parent.type !== undefined) {
			return false;
		}
		return node.type === undefined;
	}
}
