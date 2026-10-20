import ts from "typescript";
import type { NodeBodyResolver } from "src/runtime_types";
import {
	CALLABLE_BODY_KIND_DECLARATION,
	CALLABLE_BODY_KIND_EXPRESSION,
	CALLABLE_BODY_KIND_UNSUPPORTED,
} from "src/constants";
import type { CallableBodyKind } from "src/model/types/types";

/** Responsibilities: _block body classification_, _expression body classification_. **/
export class TypeScriptCallableBody {
	private readonly supported_kinds: Set<ts.SyntaxKind>;

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
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.supported_kinds = new Set([
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.FunctionExpression,
			ts.SyntaxKind.ArrowFunction,
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.Constructor,
			ts.SyntaxKind.GetAccessor,
			ts.SyntaxKind.SetAccessor,
		]);
	}
	/** Responsibilities: _public operation_. **/
	public resolve<T>(node: ts.Node, missing: T, present: NodeBodyResolver<T>): T {
		const kind = this.body_kind(node);
		if (kind === CALLABLE_BODY_KIND_UNSUPPORTED) {
			return missing;
		}
		if (kind === CALLABLE_BODY_KIND_EXPRESSION) {
			if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
				return present(node.body);
			}
		}
		return this.declaration_body(node, missing, present);
	}

	/** Responsibilities: _classification callable body kind_. **/
	public body_kind(node: ts.Node): CallableBodyKind {
		if (!this.supported_kinds.has(node.kind)) {
			return CALLABLE_BODY_KIND_UNSUPPORTED;
		}
		if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
			return CALLABLE_BODY_KIND_EXPRESSION;
		}
		return CALLABLE_BODY_KIND_DECLARATION;
	}
}
