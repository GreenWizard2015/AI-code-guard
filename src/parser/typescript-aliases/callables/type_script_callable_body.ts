import {
	CALLABLE_BODY_KIND_DECLARATION,
	CALLABLE_BODY_KIND_EXPRESSION,
	CALLABLE_BODY_KIND_UNSUPPORTED,
} from "src/constants";
import type { CallableBodyKind } from "src/model_types";
import type { CallableNodeBodyResolver } from "src/runtime_types";
import ts from "typescript";

/** Responsibilities: _block body classification_, _expression body classification_. **/
export class TypeScriptCallableBody {
	private readonly _supported_kinds: Set<ts.SyntaxKind>;

	/** Responsibilities: _callable syntax policy ownership_. **/
	public constructor(supported_kinds: readonly ts.SyntaxKind[]) {
		this._supported_kinds = new Set(supported_kinds);
	}
	/** Responsibilities: _public operation_. **/
	public resolve<T>(node: ts.Node, missing: T, present: CallableNodeBodyResolver<T>): T {
		const kind = this.body_kind(node);
		if (kind === CALLABLE_BODY_KIND_UNSUPPORTED) {
			return missing;
		}
		if (kind === CALLABLE_BODY_KIND_EXPRESSION && (ts.isArrowFunction(node) || ts.isFunctionExpression(node))) {
			return present(node.body);
		}
		let result = missing;
		node.forEachChild((child) => {
			if (ts.isBlock(child)) {
				result = present(child);
			}
		});
		return result;
	}

	/** Responsibilities: _classification callable body kind_. **/
	public body_kind(node: ts.Node): CallableBodyKind {
		if (!this._supported_kinds.has(node.kind)) {
			return CALLABLE_BODY_KIND_UNSUPPORTED;
		}
		if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
			return CALLABLE_BODY_KIND_EXPRESSION;
		}
		return CALLABLE_BODY_KIND_DECLARATION;
	}
}
