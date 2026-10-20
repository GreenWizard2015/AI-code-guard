import ts from "typescript";
import { JestAssertionShapeMatcher } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/assertions/jest_assertion_shape_matcher";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";
import type { JestAssertionAnalysisContract } from "src/testing_protocols";

/** Responsibilities: _assertion groups_, _assertion limits_. **/
export class JestAssertionGroupingRule implements JestAssertionAnalysisContract {
	private readonly expect_aliases: TypeScriptExpressionAliases;
	private readonly shape_matcher: JestAssertionShapeMatcher;

	/** Responsibilities: _unwrapping Jest expectation expression_. **/
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

	/** Responsibilities: _Jest invocation position conversion_. **/
	private line(source_file: ts.SourceFile, node: ts.CallExpression): number {
		const position = node.getStart(source_file);
		const character = source_file.getLineAndCharacterOfPosition(position);
		return character.line + 1;
	}

	/** Responsibilities: _Jest expectation statement classification_. **/
	private statement_expectation(statement: ts.Statement): boolean {
		if (!ts.isExpressionStatement(statement)) {
			return false;
		}
		return this.expect_expression(statement.expression, statement.expression);
	}

	/** Responsibilities: _classification Jest test exceeds_. **/
	private exceeds_expectation_limit(test: ts.CallExpression, limit: number): boolean {
		const candidate = test.arguments[test.arguments.length - 1];
		if (candidate === undefined) {
			return false;
		}
		if (!ts.isArrowFunction(candidate) && !ts.isFunctionExpression(candidate)) {
			return false;
		}
		if (!ts.isBlock(candidate.body)) {
			return false;
		}
		return this.expectation_count(candidate.body) >= limit;
	}

	/** Responsibilities: _reporting expression directly invokes_. **/
	private expect_expression(expression: ts.Expression, node: ts.Node): boolean {
		const current = this.unwrapped_expression(expression);
		if (ts.isAwaitExpression(current)) {
			return this.expect_expression(current.expression, node);
		}
		if (ts.isCallExpression(current)) {
			const callee = this.unwrapped_expression(current.expression);
			if (ts.isIdentifier(callee)) {
				if (this.expect_aliases.receiver(callee, current)) {
					return true;
				}
			}
			return this.expect_expression(current.expression, node);
		}
		if (ts.isPropertyAccessExpression(current)) {
			return this.expect_expression(current.expression, node);
		}
		return false;
	}

	/** Responsibilities: _assertion chain parent discovery_. **/
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

	/** Responsibilities: _assertion chain traversal_. **/
	private next_assertion_parent(node: ts.Node): ts.Node {
		if (this.member_chain_parent(node)) {
			if (node.parent === undefined) {
				return node;
			}
			return node.parent;
		}
		const parent = node.parent;
		if (parent === undefined) {
			return node;
		}
		if (!this.is_assertion_wrapper(parent)) {
			return node;
		}
		return parent;
	}

	/** Responsibilities: _assertion wrapper classification_. **/
	private is_assertion_wrapper(node: ts.Node): boolean {
		if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)) {
			return true;
		}
		if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
			return true;
		}
		return ts.isSatisfiesExpression(node);
	}

	/** Responsibilities: _property-chain parent classification_. **/
	private member_chain_parent(node: ts.Node): boolean {
		if (node.parent === undefined) {
			return false;
		}
		if (ts.isPropertyAccessExpression(node.parent)) {
			return node.parent.expression === node;
		}
		if (ts.isElementAccessExpression(node.parent)) {
			return node.parent.expression === node;
		}
		return false;
	}

	/** Responsibilities: _call-chain parent classification_. **/
	private call_chain_parent(node: ts.Node): boolean {
		if (node.parent === undefined) {
			return false;
		}
		if (!ts.isCallExpression(node.parent)) {
			return false;
		}
		return node.parent.expression === node;
	}

	/** Responsibilities: _supported expect assertion collection_. **/
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

	/** Responsibilities: _expect assertion recognition_. **/
	private append_expect_assertion(assertions: ts.CallExpression[], node: ts.Node): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		const expression = this.unwrapped_expression(node.expression);
		if (!ts.isIdentifier(expression) || !this.expect_aliases.receiver(expression, node)) {
			return false;
		}
		return this.append_assertion(assertions, node);
	}

	/** Responsibilities: _Jest expectation invocation count_. **/
	private expectation_count(body: ts.Block): number {
		let count = 0;
		for (const statement of body.statements) {
			if (this.statement_expectation(statement)) {
				count += 1;
			}
		}
		return count;
	}

	/** Responsibilities: _field initialization_. **/
	public constructor() {
		this.expect_aliases = new TypeScriptExpressionAliases("expect");
		this.shape_matcher = new JestAssertionShapeMatcher(this.expect_aliases);
	}

	/** Responsibilities: _assertion classification traversal_. **/
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

	/** Responsibilities: _shape-only assertion classification_. **/
	public shape_only(assertions: ts.CallExpression[]): boolean {
		if (assertions.length === 0) {
			return false;
		}
		for (const assertion of assertions) {
			if (!this.shape_matcher.shape_assertion(assertion)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _exception-only assertion classification_. **/
	public exception_only(assertions: ts.CallExpression[]): boolean {
		if (assertions.length === 0) {
			return false;
		}
		return assertions.every((assertion) => this.shape_matcher.exception_assertion(assertion));
	}

	/** Responsibilities: _collection lines Jest tests_. **/
	public expectation_lines(source_file: ts.SourceFile, tests: ts.CallExpression[], limit: number): number[] {
		const lines: number[] = [];
		for (const test of tests) {
			if (this.exceeds_expectation_limit(test, limit)) {
				lines.push(this.line(source_file, test));
			}
		}
		return lines;
	}
}
