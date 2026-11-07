import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _expect expression normalization_, _assertion chain traversal_. **/
export class JestAssertionChain {
	private readonly _expect_aliases: TypeScriptExpressionAliasesContract;

	/** Responsibilities: _assertion chain parent discovery_. **/
	private assertion_parent(assertion: ts.Expression): ts.Expression {
		let current = assertion;
		while (true) {
			const parent = this.next_parent(current);
			if (parent === current) {
				return current;
			}
			current = parent;
		}
	}

	/** Responsibilities: _assertion parent traversal_. **/
	private next_parent(child: ts.Expression): ts.Expression {
		if (this.member_chain_parent(child)) {
			if (child.parent === undefined || !ts.isExpression(child.parent)) {
				return child;
			}
			return child.parent;
		}
		const parent = child.parent;
		if (parent === undefined || !ts.isExpression(parent)) {
			return child;
		}
		if (!this.is_wrapper(parent)) {
			return child;
		}
		return parent;
	}

	/** Responsibilities: _assertion wrapper classification_. **/
	private is_wrapper(wrapper_expression: ts.Expression): boolean {
		if (ts.isParenthesizedExpression(wrapper_expression) || ts.isNonNullExpression(wrapper_expression)) {
			return true;
		}
		if (ts.isAsExpression(wrapper_expression) || ts.isTypeAssertionExpression(wrapper_expression)) {
			return true;
		}
		return ts.isSatisfiesExpression(wrapper_expression);
	}

	/** Responsibilities: _assertion member parent classification_. **/
	private member_chain_parent(member_expression: ts.Expression): boolean {
		if (member_expression.parent === undefined) {
			return false;
		}
		if (ts.isPropertyAccessExpression(member_expression.parent)) {
			return member_expression.parent.expression === member_expression;
		}
		if (ts.isElementAccessExpression(member_expression.parent)) {
			return member_expression.parent.expression === member_expression;
		}
		return false;
	}

	/** Responsibilities: _assertion call parent classification_. **/
	private call_chain_parent(call_expression: ts.Expression): boolean {
		if (call_expression.parent === undefined) {
			return false;
		}
		if (!ts.isCallExpression(call_expression.parent)) {
			return false;
		}
		return call_expression.parent.expression === call_expression;
	}

	/** Responsibilities: _Jest assertion chain collection_. **/
	private append_chain(assertions: ts.CallExpression[], expect_call: ts.CallExpression): boolean {
		const current = this.assertion_parent(expect_call);
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

	/** Responsibilities: _Jest assertion chain initialization_. **/
	public constructor(expect_aliases: TypeScriptExpressionAliasesContract) {
		this._expect_aliases = expect_aliases;
	}

	/** Responsibilities: _expect expression unwrapping_. **/
	public unwrapped_expression(candidate: ts.Expression): ts.Expression {
		let current = candidate;
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

	/** Responsibilities: _supported expect assertion collection_. **/
	public append_assertion(assertions: ts.CallExpression[], candidate: ts.Node): boolean {
		if (!ts.isCallExpression(candidate)) {
			return false;
		}
		const expect_expression = this.unwrapped_expression(candidate.expression);
		if (!ts.isIdentifier(expect_expression)) {
			return false;
		}
		if (!this._expect_aliases.receiver({ expression: expect_expression, node: candidate })) {
			return false;
		}
		return this.append_chain(assertions, candidate);
	}
}
