import ts from "typescript";
import { JestAssertionGroupingRule } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/assertions/jest_assertion_grouping_rule";
import { JestTestShapeRule } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_test_shape_rule";
import { JestTestResultShapeRule } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/assertions/jest_test_result_shape_rule";
import type { ViolationContract } from "src/reporting_protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { MAX_TEST_ASSERTIONS, MIN_JEST_ASSERTIONS } from "src/constants";
import type { JestAssertionAnalysisContract, JestTestAssertionContract, JestTestShapeRuleContract, JestTestShapeViolationsContract } from "src/testing_protocols";

/** Responsibilities: _test shape diagnostics_, _test result diagnostics_. **/
export class JestTestShapeViolations implements JestTestShapeViolationsContract {
	private readonly test_shape_rule: JestTestShapeRuleContract;
	private readonly result_rule: JestTestAssertionContract;
	private readonly assertion_grouping_rule: JestAssertionAnalysisContract;
	private readonly test_lambda_diagnostic: DiagnosticRule;
	private readonly test_expect_diagnostic: DiagnosticRule;
	private readonly type_test_diagnostic: DiagnosticRule;
	private readonly exception_only_diagnostic: DiagnosticRule;
	private readonly assertion_grouping_diagnostic: DiagnosticRule;
	private readonly assertion_complexity_diagnostic: DiagnosticRule;

	/** Responsibilities: _Jest test-shape dependency initialization_. **/
	public constructor() {
		this.assertion_grouping_rule = new JestAssertionGroupingRule();
		this.test_lambda_diagnostic = new DiagnosticRule("typescript-jest-test-lambda");
		this.test_expect_diagnostic = new DiagnosticRule("typescript-jest-test-expect");
		this.type_test_diagnostic = new DiagnosticRule("typescript-jest-type-only-test");
		this.exception_only_diagnostic = new DiagnosticRule("test-exception-only");
		this.assertion_grouping_diagnostic = new DiagnosticRule("test-assertion-grouping");
		this.assertion_complexity_diagnostic = new DiagnosticRule("test-too-many-assertions");
		this.test_shape_rule = new JestTestShapeRule();
		this.result_rule = new JestTestResultShapeRule(this.assertion_grouping_rule);
	}

	/** Responsibilities: _test shape diagnostics_. **/
	public shape_diagnostics(
		violations: ViolationContract[],
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
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void {
		for (const line of this.result_rule.shape_test_lines(source_file, tests)) {
			violations.push(this.type_test_diagnostic.violation(file, line));
		}
		for (const line of this.result_rule.exception_test_lines(source_file, tests)) {
			violations.push(this.exception_only_diagnostic.violation(file, line));
		}
	}

	/** Responsibilities: _test assertion diagnostics_. **/
	public assertion_diagnostics(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void {
		for (const line of this.assertion_grouping_rule.expectation_lines(source_file, tests, MIN_JEST_ASSERTIONS)) {
			violations.push(this.assertion_grouping_diagnostic.violation(file, line));
		}
		for (const line of this.assertion_grouping_rule.expectation_lines(source_file, tests, MAX_TEST_ASSERTIONS + 1)) {
			violations.push(this.assertion_complexity_diagnostic.violation(file, line));
		}
	}
}
