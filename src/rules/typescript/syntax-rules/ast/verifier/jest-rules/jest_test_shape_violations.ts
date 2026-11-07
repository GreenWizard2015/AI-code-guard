import { MAX_TEST_ASSERTIONS, MIN_JEST_ASSERTIONS } from "src/constants";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { JestAssertionGroupingRule } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/assertions/jest_assertion_grouping_rule";
import { JestTestResultShapeRule } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/assertions/jest_test_result_shape_rule";
import { JestTestShapeRule } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_test_shape_rule";
import type {
	JestAssertionAnalysisContract,
	JestTestAssertionContract,
	JestTestShapeRuleContract,
} from "src/testing_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type ts from "typescript";

/** Responsibilities: _test shape diagnostics_, _test result diagnostics_. **/
export class JestTestShapeViolations {
	private readonly _file: string;
	private readonly _source_file: ts.SourceFile;
	private readonly _tests: ts.CallExpression[];
	private readonly _test_shape_rule: JestTestShapeRuleContract;
	private readonly _result_rule: JestTestAssertionContract;
	private readonly _assertion_grouping_rule: JestAssertionAnalysisContract;
	private readonly _test_lambda_diagnostic: RuleContract;
	private readonly _test_expect_diagnostic: RuleContract;
	private readonly _type_test_diagnostic: RuleContract;
	private readonly _exception_only_diagnostic: RuleContract;
	private readonly _assertion_grouping_diagnostic: RuleContract;
	private readonly _assertion_complexity_diagnostic: RuleContract;

	/** Responsibilities: _Jest test-shape diagnostics initialization_. **/
	public constructor(
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
		expect_aliases: TypeScriptExpressionAliasesContract,
	) {
		this._file = file;
		this._source_file = source_file;
		this._tests = tests;
		this._assertion_grouping_rule = new JestAssertionGroupingRule(expect_aliases);
		this._test_lambda_diagnostic = new DiagnosticRule("typescript-jest-test-lambda");
		this._test_expect_diagnostic = new DiagnosticRule("typescript-jest-test-expect");
		this._type_test_diagnostic = new DiagnosticRule("typescript-jest-type-only-test");
		this._exception_only_diagnostic = new DiagnosticRule("test-exception-only");
		this._assertion_grouping_diagnostic = new DiagnosticRule("test-assertion-grouping");
		this._assertion_complexity_diagnostic = new DiagnosticRule("test-too-many-assertions");
		this._test_shape_rule = new JestTestShapeRule(source_file, expect_aliases);
		this._result_rule = new JestTestResultShapeRule(this._assertion_grouping_rule);
	}

	/** Responsibilities: _Jest test-shape diagnostic collection_. **/
	public shape_diagnostics(): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const line of this._test_shape_rule.non_arrow_lines(this._tests)) {
			violations.push(this._test_lambda_diagnostic.violation(this._file, line, {}));
		}
		for (const line of this._test_shape_rule.missing_expect_lines(this._tests)) {
			violations.push(this._test_expect_diagnostic.violation(this._file, line, {}));
		}
		return violations;
	}

	/** Responsibilities: _test result shape diagnostics_. **/
	public result_diagnostics(): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const line of this._result_rule.shape_test_lines(this._tests)) {
			violations.push(this._type_test_diagnostic.violation(this._file, line, {}));
		}
		for (const line of this._result_rule.exception_test_lines(this._tests)) {
			violations.push(this._exception_only_diagnostic.violation(this._file, line, {}));
		}
		return violations;
	}

	/** Responsibilities: _test assertion diagnostics_. **/
	public assertion_diagnostics(): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const line of this._assertion_grouping_rule.expectation_lines(
			this._source_file,
			this._tests,
			MIN_JEST_ASSERTIONS,
		)) {
			violations.push(this._assertion_grouping_diagnostic.violation(this._file, line, {}));
		}
		for (const line of this._assertion_grouping_rule.expectation_lines(
			this._source_file,
			this._tests,
			MAX_TEST_ASSERTIONS + 1,
		)) {
			violations.push(this._assertion_complexity_diagnostic.violation(this._file, line, {}));
		}
		return violations;
	}
}
