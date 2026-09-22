import ts from 'typescript';
import { JestAssertionShapeMatcher } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/jest-assertion-shape-matcher';

/** Responsibilities: _collection Jest assertions classification_. **/
export class JestAssertionShapeRule {
	private readonly expect_name = 'expect';
	private readonly matcher = new JestAssertionShapeMatcher();

	/** Responsibilities: _aggregation expectation invocation it_. **/
	private append_assertion(assertions: ts.CallExpression[], expect_call: ts.CallExpression): boolean {
		let current: ts.Node = expect_call;
		while (this.property_chain_parent(current)) {
			current = current.parent;
		}
		if (this.call_chain_parent(current)) {
			if (!ts.isCallExpression(current.parent)) {
				return false;
			}
			const assertion = current.parent;
			assertions.push(assertion);
			return true;
		}
		return false;
	}

	/** Responsibilities: _classification expect invocation belongs_. **/
	private property_chain_parent(node: ts.Node): boolean {
		if (node.parent === undefined) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(node.parent)) {
			return false;
		}
		return node.parent.expression === node;
	}

	/** Responsibilities: _classification expect invocation belongs_. **/
	private call_chain_parent(node: ts.Node): boolean {
		if (node.parent === undefined) {
			return false;
		}
		if (!ts.isCallExpression(node.parent)) {
			return false;
		}
		return node.parent.expression === node;
	}

	/** Responsibilities: _aggregation supported expect assertion_. **/
	private append_expect_assertion(
		assertions: ts.CallExpression[],
		node: ts.Node
	): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		if (!ts.isIdentifier(node.expression)) {
			return false;
		}
		if (node.expression.text !== this.expect_name) {
			return false;
		}
		return this.append_assertion(assertions, node);
	}

	/** Responsibilities: _collection supported Jest expect_. **/
	public collect_assertions(node: ts.Node): ts.CallExpression[] {
		const assertions: ts.CallExpression[] = [];
		const visit = (child: ts.Node): void => {
			if (this.append_expect_assertion(assertions, child)) {
				return;
			}
			ts.forEachChild(child, visit);
		};
		visit(node);
		return assertions;
	}

	/** Responsibilities: _reporting assertions only shape_. **/
	public shape_only(assertions: ts.CallExpression[]): boolean {
		if (assertions.length === 0) {
			return false;
		}
		for (const assertion of assertions) {
			if (!this.matcher.shape_assertion(assertion)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _reporting assertions only exception_. **/
	public exception_only(assertions: ts.CallExpression[]): boolean {
		if (assertions.length === 0) {
			return false;
		}
		return assertions.every(assertion => this.matcher.exception_assertion(assertion));
	}
}
