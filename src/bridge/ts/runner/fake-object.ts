import ts from 'typescript';

/** Responsibilities: _callable object properties identification_, _fake objects classification_. **/
export class FakeObject {
	private readonly callable_kinds = new Set([
		ts.SyntaxKind.MethodDeclaration,
		ts.SyntaxKind.ArrowFunction,
		ts.SyntaxKind.FunctionExpression,
	]);

	/** Responsibilities: _identification callable object member_. **/
	private callable_member(property: ts.ObjectLiteralElementLike): boolean {
		if (ts.isMethodDeclaration(property)) {
			return true;
		}
		if (!ts.isPropertyAssignment(property)) {
			return false;
		}
		return this.callable_kinds.has(property.initializer.kind);
	}

	/** Responsibilities: _identification callable properties object_. **/
	public contains_callable_property(node: ts.ObjectLiteralExpression): boolean {
		for (const property of node.properties) {
			if (this.callable_member(property)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _identification object literals containing_. **/
	public fake_object(node: ts.Node): boolean {
		if (!ts.isObjectLiteralExpression(node)) {
			return false;
		}
		return this.contains_callable_property(node);
	}
}
