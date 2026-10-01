import ts from "typescript";
import { JestTestEndingRule } from "src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/jest-test-ending-rule";
import { JestTestShapeViolations } from "src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/jest-test-shape-violations";
import { JestSuiteCollector } from "src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/jest-suite-collector";
import { JestTestSize } from "src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/jest-test-size";
import type { JestSuite } from "src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/types";
import type { Violation } from "src/protocols";
import { DiagnosticRule } from "src/model/diagnostic-rule";
import {
	MAX_CLASS_LINES,
	MAX_FUNCTION_LINES,
	MAX_JEST_TESTS,
	MIN_CLASS_LINES,
	MIN_FUNCTION_LINES,
	TYPESCRIPT_TEST_SUFFIXES,
} from "src/constants";

/** Responsibilities: _collection Jest test structure_. **/
export class JestTestRules {
	private readonly suite_collector = new JestSuiteCollector();
	private readonly test_size = new JestTestSize();
	private readonly min_count_rule = new DiagnosticRule("typescript-jest-min-count");
	private readonly max_count_rule = new DiagnosticRule("typescript-jest-max-count");
	private readonly min_size_rule = new DiagnosticRule("typescript-jest-min-size");
	private readonly max_size_rule = new DiagnosticRule("typescript-jest-max-size");
	private readonly max_test_rule = new DiagnosticRule("test-max-size");
	private readonly min_test_rule = new DiagnosticRule("test-min-size");
	private readonly test_ending_rule = new JestTestEndingRule();
	private readonly test_ending_diagnostic = new DiagnosticRule("typescript-jest-test-ending");
	private readonly shape_violations = new JestTestShapeViolations();
	private readonly describe_count_rule = new DiagnosticRule("typescript-jest-describe-count");
	private readonly nested_describe_rule = new DiagnosticRule("typescript-jest-nested-describe");

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
			this.suite_collector.with_callback(test, (callback) => {
				if (callback.body === undefined || !ts.isBlock(callback.body)) {
					return;
				}
				const size = this.test_size.body(source_file, [callback.body]);
				if (size < MIN_FUNCTION_LINES) {
					violations.push(this.min_test_rule.violation(file, this.suite_line(source_file, test)));
				}
				if (size > MAX_FUNCTION_LINES) {
					violations.push(this.max_test_rule.violation(file, this.suite_line(source_file, test)));
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
		const top_level_suites = suites.filter((suite) => !suite.nested);
		if (top_level_suites.length !== 1) {
			violations.push(
				this.describe_count_rule.violation(file, 1, {
					count: String(top_level_suites.length),
				}),
			);
		}
		for (const suite of suites.filter((candidate) => candidate.nested)) {
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

	/** Responsibilities: _aggregation violations Jest suite_. **/
	private append_suite_limits(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		suite: JestSuite,
	): void {
		const line = this.suite_line(source_file, suite.node);
		this.append_count(violations, file, line, this.test_ending_rule.test_count(suite.tests));
		this.append_size(violations, file, line, this.test_size.suite(source_file, suite));
		this.append_test_sizes(violations, file, source_file, suite.tests);
	}

	/** Responsibilities: _suite shape diagnostics_. **/
	private append_suite_shape(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void {
		this.shape_violations.shape_diagnostics(violations, file, source_file, tests);
		this.shape_violations.result_diagnostics(violations, file, source_file, tests);
		this.shape_violations.assertion_diagnostics(violations, file, source_file, tests);
	}

	/** Responsibilities: _Jest suite diagnostics aggregation_. **/
	private append_suite_violations(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		suite: JestSuite,
	): void {
		this.append_suite_limits(violations, file, source_file, suite);
		this.append_suite_shape(violations, file, source_file, suite.tests);
		this.append_test_end(violations, file, source_file, suite.tests);
	}

	/** Responsibilities: _aggregation Jest violations source_. **/
	public append_violations(violations: Violation[], file: string, source_file: ts.SourceFile): void {
		if (!this.jest_file(file)) {
			return;
		}
		const suites = this.suite_collector.suites(source_file);
		this.append_structure_violations(violations, file, source_file, suites);
		const top_level_suites = suites.filter((suite) => !suite.nested);
		if (top_level_suites.length !== 1 || suites.length !== 1) {
			return;
		}
		this.append_suite_violations(violations, file, source_file, top_level_suites[0]);
	}

	/** Responsibilities: _Jest test files identification_. **/
	public jest_file(file: string): boolean {
		return TYPESCRIPT_TEST_SUFFIXES.some((suffix) => file.endsWith(suffix));
	}
}
