import ts from "typescript";
import type { CallableBodyKind } from "src/typescript-callable-aliases/types";
import type { NodeBodyResolver } from "src/protocols";

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
	private declaration_body<T>(node: ts.Node, missing: T, present: NodeBodyResolver<T>): T {
		let result = missing;
		node.forEachChild((child) => {
			if (ts.isBlock(child)) {
				result = present(child);
			}
		});
		return result;
	}

	/** Responsibilities: _callable body resolution_. **/
	public resolve<T>(node: ts.Node, missing: T, present: NodeBodyResolver<T>): T {
		const kind = this.body_kind(node);
		if (kind === "unsupported") {
			return missing;
		}
		if (kind === "expression" && (ts.isArrowFunction(node) || ts.isFunctionExpression(node))) {
			return present(node.body);
		}
		return this.declaration_body(node, missing, present);
	}

	/** Responsibilities: _classification callable body kind_. **/
	public body_kind(node: ts.Node): CallableBodyKind {
		if (!this.supported_kinds.has(node.kind)) {
			return "unsupported";
		}
		if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
			return "expression";
		}
		return "declaration";
	}
}
