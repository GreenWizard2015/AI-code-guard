import ts from 'typescript';
import { MAX_TEST_ASSERTIONS } from 'src/constants';
import { TypeScriptExpressionAliases } from 'src/typescript-aliases/typescript-expression-aliases';

/** Responsibilities: _Jest expectation count reporting_. **/
export class JestAssertionGroupingRule {
	public readonly minimum_expectations = 3;
	public readonly maximum_expectations = MAX_TEST_ASSERTIONS;
	private readonly expect_aliases = new TypeScriptExpressionAliases('expect');

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
if (candidate === undefined || (!ts.isArrowFunction(candidate) && !ts.isFunctionExpression(candidate))) {
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

	/** Responsibilities: _Jest expectation invocation count_. **/
	public expectation_count(body: ts.Block): number {
		let count = 0;
		for (const statement of body.statements) {
			if (this.statement_expectation(statement)) {
				count += 1;
			}
		}
		return count;
	}

	/** Responsibilities: _collection lines Jest tests_. **/
	public expectation_lines(
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
		limit: number
	): number[] {
		const lines: number[] = [];
		for (const test of tests) {
			if (this.exceeds_expectation_limit(test, limit)) {
				lines.push(this.line(source_file, test));
			}
		}
		return lines;
	}

}
