import ts from 'typescript';
import { MAX_TEST_ASSERTIONS } from 'src/constants';

/** Responsibilities: _Jest expectation count reporting_. **/
export class JestAssertionGroupingRule {
	public readonly minimum_expectations = 3;
	public readonly maximum_expectations = MAX_TEST_ASSERTIONS;

	/** Responsibilities: _Jest invocation position conversion_. **/
	private line(source_file: ts.SourceFile, node: ts.CallExpression): number {
		const position = node.getStart(source_file);
		const character = source_file.getLineAndCharacterOfPosition(position);
		return character.line + 1;
	}

	/** Responsibilities: _Jest expectation invocation count_. **/
	private expectation_count(body: ts.Block): number {
		let count = 0;
		for (const statement of body.statements) {
if (ts.isExpressionStatement(statement) && this.expect_expression(statement.expression)) {
				count += 1;
			}
		}
		return count;
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

	/** Responsibilities: _reporting expression directly invokes_. **/
	public expect_expression(expression: ts.Expression): boolean {
		if (ts.isAwaitExpression(expression)) {
			return this.expect_expression(expression.expression);
		}
		if (ts.isCallExpression(expression)) {
if (ts.isIdentifier(expression.expression) && expression.expression.text === 'expect') {
				return true;
			}
			return this.expect_expression(expression.expression);
		}
		if (ts.isPropertyAccessExpression(expression)) {
			return this.expect_expression(expression.expression);
		}
		return false;
	}

}
