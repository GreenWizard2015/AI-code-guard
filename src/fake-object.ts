import ts from "typescript";
import { TypeScriptCallableAliases } from "src/typescript-callable-aliases";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/typescript-expression-aliases";
import { TypeScriptObjectCallableAliases } from "src/typescript-callable-aliases/object-callable-aliases";

/** Responsibilities: _callable object properties identification_, _fake objects classification_. **/
export class FakeObject {
	private readonly callable_aliases = new TypeScriptCallableAliases();
	private readonly expression_aliases = new TypeScriptExpressionAliases("");
	private readonly object_aliases = new TypeScriptObjectCallableAliases();
	private readonly callable_kinds = new Set([
		ts.SyntaxKind.MethodDeclaration,
		ts.SyntaxKind.GetAccessor,
		ts.SyntaxKind.SetAccessor,
		ts.SyntaxKind.ArrowFunction,
		ts.SyntaxKind.FunctionExpression,
	]);

	/** Responsibilities: _callable shorthand member classification_. **/
	private callable_shorthand(property: ts.ShorthandPropertyAssignment): boolean {
		if (this.callable_aliases.contains(property.name, property)) {
			return true;
		}
		return this.object_aliases.contains(property.name, property);
	}

	/** Responsibilities: _callable assigned member classification_. **/
	private callable_assignment(property: ts.PropertyAssignment): boolean {
		const initializer = this.expression_aliases.unwrapped(property.initializer);
		if (this.callable_kinds.has(initializer.kind)) {
			return true;
		}
		if (this.callable_aliases.contains(initializer, property)) {
			return true;
		}
		return this.object_aliases.contains(initializer, property);
	}

	/** Responsibilities: _identification callable object member_. **/
	public callable_member(property: ts.ObjectLiteralElementLike): boolean {
		if (ts.isMethodDeclaration(property) || ts.isGetAccessor(property) || ts.isSetAccessor(property)) {
			return true;
		}
		if (ts.isShorthandPropertyAssignment(property)) {
			return this.callable_shorthand(property);
		}
		if (ts.isPropertyAssignment(property)) {
			return this.callable_assignment(property);
		}
		return false;
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
