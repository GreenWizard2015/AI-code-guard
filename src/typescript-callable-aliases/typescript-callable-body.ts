import ts from 'typescript';

/** Responsibilities: _classification TypeScript callable bodies_. **/
export class TypeScriptCallableBody {
	private readonly supported_kinds = new Set([
		ts.SyntaxKind.FunctionDeclaration,
		ts.SyntaxKind.FunctionExpression,
		ts.SyntaxKind.ArrowFunction,
		ts.SyntaxKind.MethodDeclaration,
		ts.SyntaxKind.Constructor,
		ts.SyntaxKind.GetAccessor,
		ts.SyntaxKind.SetAccessor,
	]);

	/** Responsibilities: _declaration body resolution_. **/
	private declaration_body<T>(
		node: ts.Node,
		missing: T,
		present: (body: ts.Node) => T
	): T {
		let result = missing;
		node.forEachChild(child => {
			if (ts.isBlock(child)) {
				result = present(child);
			}
		});
		return result;
	}

	/** Responsibilities: _callable body resolution_. **/
	public resolve<T>(
		node: ts.Node,
		missing: T,
		present: (body: ts.Node) => T
	): T {
		if (!this.supported_kinds.has(node.kind)) {
			return missing;
		}
		if (ts.isArrowFunction(node)) {
			return present(node.body);
		}
		if (ts.isFunctionExpression(node)) {
			return present(node.body);
		}
		return this.declaration_body(node, missing, present);
	}

	/** Responsibilities: _implemented callable classification_. **/
	public implemented(node: ts.Node): boolean {
		const result = this.resolve(node, false, () => true);
		if (result) {
			return true;
		}
		return false;
	}
}
