import { JestAssertionChain } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/assertions/jest_assertion_chain";
import { JestAssertionShapeMatcher } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/assertions/jest_assertion_shape_matcher";
import type { JestAssertionAnalysisContract } from "src/testing_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _assertion groups_, _assertion limits_. **/
export class JestAssertionGroupingRule implements JestAssertionAnalysisContract {
	private readonly _expect_aliases: TypeScriptExpressionAliasesContract;
	private readonly _assertion_chain: JestAssertionChain;
	private readonly _shape_matcher: JestAssertionShapeMatcher;

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
		return this.expect_expression(statement.expression);
	}

	/** Responsibilities: _classification Jest test exceeds_. **/
	private exceeds_expectation_limit(test: ts.CallExpression, limit: number): boolean {
		const candidate = test.arguments.at(-1);
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
	private expect_expression(expected_expression: ts.Expression): boolean {
		const current = this._assertion_chain.unwrapped_expression(expected_expression);
		if (ts.isAwaitExpression(current)) {
			return this.expect_expression(current.expression);
		}
		if (ts.isCallExpression(current)) {
			const callee = this._assertion_chain.unwrapped_expression(current.expression);
			if (ts.isIdentifier(callee)) {
				if (this._expect_aliases.receiver({ expression: callee, node: current })) {
					return true;
				}
			}
			return this.expect_expression(current.expression);
		}
		if (ts.isPropertyAccessExpression(current)) {
			return this.expect_expression(current.expression);
		}
		return false;
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
	public constructor(expect_aliases: TypeScriptExpressionAliasesContract) {
		this._expect_aliases = expect_aliases;
		this._assertion_chain = new JestAssertionChain(expect_aliases);
		this._shape_matcher = new JestAssertionShapeMatcher(expect_aliases);
	}

	/** Responsibilities: _assertion classification traversal_. **/
	public collect_assertions(root: ts.Node): ts.CallExpression[] {
		const assertions: ts.CallExpression[] = [];
		const visit = (candidate: ts.Node): void => {
			if (this._assertion_chain.append_assertion(assertions, candidate)) {
				return;
			}
			ts.forEachChild(candidate, visit);
		};
		visit(root);
		return assertions;
	}

	/** Responsibilities: _shape-only assertion classification_. **/
	public shape_only(shape_assertions: ts.CallExpression[]): boolean {
		if (shape_assertions.length === 0) {
			return false;
		}
		for (const assertion of shape_assertions) {
			if (!this._shape_matcher.shape_assertion(assertion)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _exception-only assertion classification_. **/
	public exception_only(exception_assertions: ts.CallExpression[]): boolean {
		if (exception_assertions.length === 0) {
			return false;
		}
		return exception_assertions.every((assertion) => this._shape_matcher.exception_assertion(assertion));
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
