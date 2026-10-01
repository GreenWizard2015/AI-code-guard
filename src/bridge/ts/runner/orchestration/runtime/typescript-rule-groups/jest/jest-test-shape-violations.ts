import ts from "typescript";
import { JestAssertionGroupingRule } from "src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/jest-assertion-grouping-rule";
import { JestTestShapeRule } from "src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/jest-test-shape-rule";
import type { Violation } from "src/protocols";
import { DiagnosticRule } from "src/model/diagnostic-rule";

/** Responsibilities: _Jest test shape diagnostics_. **/
export class JestTestShapeViolations {
	private readonly test_shape_rule = new JestTestShapeRule();
	private readonly assertion_grouping_rule = new JestAssertionGroupingRule();
	private readonly test_lambda_diagnostic = new DiagnosticRule("typescript-jest-test-lambda");
	private readonly test_expect_diagnostic = new DiagnosticRule("typescript-jest-test-expect");
	private readonly type_test_diagnostic = new DiagnosticRule("typescript-jest-type-only-test");
	private readonly exception_only_diagnostic = new DiagnosticRule("test-exception-only");
	private readonly assertion_grouping_diagnostic = new DiagnosticRule("test-assertion-grouping");
	private readonly assertion_complexity_diagnostic = new DiagnosticRule("test-too-many-assertions");

	/** Responsibilities: _test shape diagnostics_. **/
	public shape_diagnostics(
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
	}

	/** Responsibilities: _test result shape diagnostics_. **/
	public result_diagnostics(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void {
		for (const line of this.test_shape_rule.shape_test_lines(source_file, tests)) {
			violations.push(this.type_test_diagnostic.violation(file, line));
		}
		for (const line of this.test_shape_rule.exception_test_lines(source_file, tests)) {
			violations.push(this.exception_only_diagnostic.violation(file, line));
		}
	}

	/** Responsibilities: _test assertion diagnostics_. **/
	public assertion_diagnostics(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void {
		for (const line of this.assertion_grouping_rule.expectation_lines(
			source_file,
			tests,
			this.assertion_grouping_rule.minimum_expectations,
		)) {
			violations.push(this.assertion_grouping_diagnostic.violation(file, line));
		}
		for (const line of this.assertion_grouping_rule.expectation_lines(
			source_file,
			tests,
			this.assertion_grouping_rule.maximum_expectations + 1,
		)) {
			violations.push(this.assertion_complexity_diagnostic.violation(file, line));
		}
	}
}
