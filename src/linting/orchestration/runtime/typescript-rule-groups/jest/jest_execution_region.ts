import ts from "typescript";
import type { JestExecutionConsumer } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/types";

/** Responsibilities: _Jest execution region_, _callable boundary traversal_. **/
export class JestExecutionRegion {
	private readonly root: ts.Node;
	private readonly consumer: JestExecutionConsumer;

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
	public constructor(root: ts.Node, consumer: JestExecutionConsumer) {
		this.root = root;
		this.consumer = consumer;
	}

	/** Responsibilities: _execution membership_. **/
	public active(node: ts.Node): boolean {
		if (node === this.root) {
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
			this.consumer(node);
			node.forEachChild(visit);
		};
		visit(this.root);
	}
}
