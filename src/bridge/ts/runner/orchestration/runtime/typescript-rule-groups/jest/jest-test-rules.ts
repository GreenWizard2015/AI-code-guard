import ts from 'typescript';
import { TypeScriptStatementSloc } from 'src/typescript-statement-sloc';
import { JestTestEndingRule } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/jest-test-ending-rule';
import { JestTestShapeRule } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/jest-test-shape-rule';
import { JestAssertionGroupingRule } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/jest-assertion-grouping-rule';
import { JestSuiteCollector } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/jest-suite-collector';
import type { JestSuite } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/types';
import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import { MAX_CLASS_LINES, MAX_FUNCTION_LINES, MAX_JEST_TESTS, MIN_CLASS_LINES, MIN_FUNCTION_LINES } from 'src/constants';

/** Responsibilities: _collection Jest test structure_. **/
export class JestTestRules {
	private readonly suite_collector = new JestSuiteCollector();
	private readonly statement_sloc = new TypeScriptStatementSloc();
	private readonly min_count_rule = new DiagnosticRule('typescript-jest-min-count');
	private readonly max_count_rule = new DiagnosticRule('typescript-jest-max-count');
	private readonly min_size_rule = new DiagnosticRule('typescript-jest-min-size');
	private readonly max_size_rule = new DiagnosticRule('typescript-jest-max-size');
	private readonly max_test_rule = new DiagnosticRule('test-max-size');
	private readonly min_test_rule = new DiagnosticRule('test-min-size');
	private readonly test_ending_rule = new JestTestEndingRule();
	private readonly test_ending_diagnostic = new DiagnosticRule('typescript-jest-test-ending');
	private readonly test_shape_rule = new JestTestShapeRule();
	private readonly assertion_grouping_rule = new JestAssertionGroupingRule();
	private readonly test_lambda_diagnostic = new DiagnosticRule('typescript-jest-test-lambda');
	private readonly test_expect_diagnostic = new DiagnosticRule('typescript-jest-test-expect');
	private readonly type_test_diagnostic = new DiagnosticRule('typescript-jest-type-only-test');
	private readonly exception_only_diagnostic = new DiagnosticRule('test-exception-only');
	private readonly assertion_grouping_diagnostic = new DiagnosticRule('test-assertion-grouping');
	private readonly assertion_complexity_diagnostic = new DiagnosticRule('test-too-many-assertions');
	private readonly describe_count_rule = new DiagnosticRule('typescript-jest-describe-count');
	private readonly nested_describe_rule = new DiagnosticRule('typescript-jest-nested-describe');

	/** Responsibilities: _measure test body lines_. **/
	private body_lines(source_file: ts.SourceFile, bodies: ts.Block[]): number {
		if (bodies.length === 0) {
			return 0;
		}
		const body = bodies[0];
		if (body.statements.length === 0) {
			return 0;
		}
		const first = body.statements[0];
		const last = body.statements[body.statements.length - 1];
		return (source_file.getLineAndCharacterOfPosition(last.end - 1).line -
			source_file.getLineAndCharacterOfPosition(first.getStart(source_file)).line) + 1;
	}

	/** Responsibilities: _measure test body size_. **/
	private body_size(source_file: ts.SourceFile, bodies: ts.Block[]): number {
		if (bodies.length === 0) {
			return source_file.statements.length;
		}
		const body = bodies[0];
		let sloc = 0;
		if (this.statement_sloc.compound_statement(body)) {
			sloc = this.statement_sloc.compound_sloc(body);
		}
		return (this.body_lines(source_file, bodies) + sloc) / 2;
	}

	/** Responsibilities: _test violation count addition_. **/
	private append_count(violations: Violation[], file: string, line: number, count: number): void {
		if (count < 2) {
			violations.push(this.min_count_rule.violation(file, line, { count: String(count) }));
			return;
		}
		if (count > MAX_JEST_TESTS) {
			violations.push(this.max_count_rule.violation(file, line, { count: String(count) }));
		}
	}

	/** Responsibilities: _size violations addition testing_. **/
	private append_size(violations: Violation[], file: string, line: number, size: number): void {
		if (size < MIN_CLASS_LINES) {
				violations.push(this.min_size_rule.violation(file, line, { size: String(size) }));
		}
		if (size > MAX_CLASS_LINES) {
			violations.push(this.max_size_rule.violation(file, line, { size: String(size) }));
		}
	}

	/** Responsibilities: _aggregation individual test size_. **/
	private append_test_sizes(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void {
		for (const test of tests) {
			this.suite_collector.with_callback(test, callback => {
				if (callback.body === undefined || !ts.isBlock(callback.body)) {
					return;
				}
				const size = this.body_size(source_file, [callback.body]);
				if (size < MIN_FUNCTION_LINES) {
					violations.push(this.min_test_rule.violation(file, this.suite_line(source_file, test)));
				}
				if (size > MAX_FUNCTION_LINES) {
					violations.push(
						this.max_test_rule.violation(file, this.suite_line(source_file, test))
					);
				}
			});
		}
	}

	/** Responsibilities: _resolution Jest suite line_. **/
	private suite_line(source_file: ts.SourceFile, node: ts.CallExpression): number {
		const position = node.getStart(source_file);
		const character = source_file.getLineAndCharacterOfPosition(position);
		return character.line + 1;
	}

	/** Responsibilities: _aggregation Jest suite structure_. **/
	private append_structure_violations(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		suites: JestSuite[],
	): void {
		const top_level_suites = suites.filter(suite => !suite.nested);
		if (top_level_suites.length !== 1) {
				violations.push(this.describe_count_rule.violation(file, 1, { count: String(top_level_suites.length) }));
		}
		for (const suite of suites.filter(candidate => candidate.nested)) {
			violations.push(this.nested_describe_rule.violation(file, this.suite_line(source_file, suite.node)));
		}
	}

	/** Responsibilities: _test-ending violations addition_. **/
	private append_test_end(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void {
		for (const line of this.test_ending_rule.invalid_test_lines(source_file, tests)) {
			violations.push(this.test_ending_diagnostic.violation(file, line));
		}
	}

	/** Responsibilities: _assertion limit violations addition_. **/
	private append_assertion_limits(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void {
		for (const line of this.assertion_grouping_rule.expectation_lines(source_file, tests, this.assertion_grouping_rule.minimum_expectations)) {
			violations.push(this.assertion_grouping_diagnostic.violation(file, line));
		}
		for (const line of this.assertion_grouping_rule.expectation_lines(source_file, tests, this.assertion_grouping_rule.maximum_expectations + 1)) {
			violations.push(this.assertion_complexity_diagnostic.violation(file, line));
		}
	}

	/** Responsibilities: _shape violations addition testing_. **/
	private append_test_shape(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void {
		for (const line of this.test_shape_rule.non_arrow_lines(source_file, tests)) {
			violations.push(this.test_lambda_diagnostic.violation(file, line));
		}
		for (const line of this.test_shape_rule.missing_expect_lines(source_file, tests)) {
			violations.push(this.test_expect_diagnostic.violation(file, line));
		}
		for (const line of this.test_shape_rule.shape_test_lines(source_file, tests)) {
			violations.push(this.type_test_diagnostic.violation(file, line));
		}
		for (const line of this.test_shape_rule.exception_test_lines(source_file, tests)) {
			violations.push(this.exception_only_diagnostic.violation(file, line));
		}
		this.append_assertion_limits(violations, file, source_file, tests);
	}

	/** Responsibilities: _aggregation violations Jest suite_. **/
	private append_suite_violations(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		suite: JestSuite,
	): void {
		const line = this.suite_line(source_file, suite.node);
		this.append_count(violations, file, line, this.test_ending_rule.test_count(suite.tests));
		this.append_size(violations, file, line, this.body_size(source_file, suite.body));
		this.append_test_sizes(violations, file, source_file, suite.tests);
		this.append_test_shape(violations, file, source_file, suite.tests);
		this.append_test_end(violations, file, source_file, suite.tests);
	}

	/** Responsibilities: _aggregation Jest violations source_. **/
	public append_violations(violations: Violation[], file: string, source_file: ts.SourceFile): void {
		if (!this.jest_file(file)) {
			return;
		}
		const suites = this.suite_collector.suites(source_file);
		this.append_structure_violations(violations, file, source_file, suites);
		const top_level_suites = suites.filter(suite => !suite.nested);
		if (top_level_suites.length !== 1 || suites.length !== 1) {
			return;
		}
		this.append_suite_violations(violations, file, source_file, top_level_suites[0]);
	}

	/** Responsibilities: _Jest test files identification_. **/
	public jest_file(file: string): boolean {
		if (file.endsWith('.test.ts')) {
			return true;
		}
		return file.endsWith('.test.tsx');
	}
}
