import ts from "typescript";
import { JestAssertionShapeMatcher } from "src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/jest-assertion-shape-matcher";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/typescript-expression-aliases";

/** Responsibilities: _collection Jest assertions classification_. **/
export class JestAssertionShapeRule {
	private readonly matcher = new JestAssertionShapeMatcher();
	private readonly expect_aliases = new TypeScriptExpressionAliases("expect");

	/** Responsibilities: _unwrapping Jest assertion callee_. **/
	private unwrapped_expression(expression: ts.Expression): ts.Expression {
		let current = expression;
		while (true) {
			if (ts.isParenthesizedExpression(current) || ts.isNonNullExpression(current)) {
				current = current.expression;
				continue;
			}
			if (ts.isAsExpression(current) || ts.isTypeAssertionExpression(current)) {
				current = current.expression;
				continue;
			}
			if (ts.isSatisfiesExpression(current)) {
				current = current.expression;
				continue;
			}
			return current;
		}
	}

	/** Responsibilities: _aggregation expectation invocation it_. **/
	private append_assertion(assertions: ts.CallExpression[], expect_call: ts.CallExpression): boolean {
		const current = this.assertion_chain_parent(expect_call);
		if (!this.call_chain_parent(current)) {
			return false;
		}
		const parent = current.parent;
		if (parent === undefined) {
			return false;
		}
		if (!ts.isCallExpression(parent)) {
			return false;
		}
		assertions.push(parent);
		return true;
	}

	/** Responsibilities: _Jest assertion chain parent_. **/
	private assertion_chain_parent(node: ts.Node): ts.Node {
		let current = node;
		while (true) {
			const parent = this.next_assertion_parent(current);
			if (parent === current) {
				return current;
			}
			current = parent;
		}
	}

	/** Responsibilities: _Jest assertion parent traversal_. **/
	private next_assertion_parent(node: ts.Node): ts.Node {
		if (this.property_chain_parent(node)) {
			if (node.parent !== undefined) {
				return node.parent;
			}
		}
		return this.assertion_wrapper_parent(node);
	}

	/** Responsibilities: _Jest assertion wrapper parent_. **/
	private assertion_wrapper_parent(node: ts.Node): ts.Node {
		const parent = node.parent;
		if (parent === undefined) {
			return node;
		}
		if (!this.is_assertion_wrapper(parent)) {
			return node;
		}
		return parent;
	}

	/** Responsibilities: _Jest assertion wrapper classification_. **/
	private is_assertion_wrapper(node: ts.Node): boolean {
		if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)) {
			return true;
		}
		if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
			return true;
		}
		return ts.isSatisfiesExpression(node);
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
	private append_expect_assertion(assertions: ts.CallExpression[], node: ts.Node): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		const expression = this.unwrapped_expression(node.expression);
		if (!ts.isIdentifier(expression)) {
			return false;
		}
		if (!this.expect_aliases.receiver(expression, node)) {
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
		return assertions.every((assertion) => this.matcher.exception_assertion(assertion));
	}
}
