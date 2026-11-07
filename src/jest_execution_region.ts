import type { CallableJestExecutionConsumer } from "src/model_types";
import ts from "typescript";

/** Responsibilities: _Jest execution region_, _callable boundary traversal_. **/
export class JestExecutionRegion {
	private readonly _root: ts.Node;
	private readonly _consumer: CallableJestExecutionConsumer;

	/** Responsibilities: _immediately invoked callable detection_. **/
	private immediately_invoked(node: ts.Node): boolean {
		const parent = node.parent;
		if (ts.isCallExpression(parent)) {
			return parent.expression === node;
		}
		if (!ts.isParenthesizedExpression(parent)) {
			return false;
		}
		const call = parent.parent;
		if (ts.isCallExpression(call)) {
			return call.expression === parent;
		}
		return false;
	}

	/** Responsibilities: _execution region initialization_. **/
	public constructor(root: ts.Node, consumer: CallableJestExecutionConsumer) {
		this._root = root;
		this._consumer = consumer;
	}

	/** Responsibilities: _execution membership_. **/
	public active(node: ts.Node): boolean {
		if (node === this._root) {
			return true;
		}
		if (!ts.isFunctionLike(node)) {
			return true;
		}
		return this.immediately_invoked(node);
	}

	/** Responsibilities: _region traversal_. **/
	public visit(): void {
		const visit = (node: ts.Node): void => {
			if (!this.active(node)) {
				return;
			}
			this._consumer(node);
			node.forEachChild(visit);
		};
		visit(this._root);
	}
}
