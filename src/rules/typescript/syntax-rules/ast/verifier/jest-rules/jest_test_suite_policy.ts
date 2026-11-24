import {
	MAX_CLASS_LINES,
	MAX_TESTS_PER_SUITE,
	MAX_TEST_LINES,
	MIN_CLASS_LINES,
	MIN_TESTS_PER_SUITE,
	MIN_TEST_LINES,
} from "src/constants";
import type { JestSuite } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { DiagnosticRuleContract } from "src/model/protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { JestTestEndingRule } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/assertions/jest_test_ending_rule";
import { JestAsyncCompletionRules } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/async/jest_async_completion_rules";
import { JestSetupRules } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_setup_rules";
import { JestTestShapeViolations } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/test-shape/jest_test_shape_violations";
import { JestTestSize } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/test-shape/jest_test_size";
import type {
	JestRulePair,
	JestTestSuitePolicyOptions,
} from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/types";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { JestInlineAssertionObjectLiteralsContract } from "src/testing_protocols";
import type {
	JestAsyncCompletionRulesContract,
	JestSetupRulesContract,
	JestSuiteCollectorContract,
	JestTestSizeContract,
} from "src/testing_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type ts from "typescript";

/** Responsibilities: _suite structure policy_, _test callback policy_. **/
export class JestTestSuitePolicy {
	private readonly _file: string;
	private readonly _source_file: ts.SourceFile;
	private readonly _suite_collector: JestSuiteCollectorContract;
	private readonly _suite_tests: ts.CallExpression[];
	private readonly _test_size: JestTestSizeContract;
	private readonly _count_rules: JestRulePair;
	private readonly _suite_size_rules: JestRulePair;
	private readonly _test_size_rules: JestRulePair;
	private readonly _test_ending_rule: JestTestEndingRule;
	private readonly _test_ending_diagnostic: DiagnosticRuleContract;
	private readonly _inline_objects: JestInlineAssertionObjectLiteralsContract;
	private readonly _expect_aliases: TypeScriptExpressionAliasesContract;
	private readonly _suite_rules: JestRulePair;
	private readonly _async_completion: JestAsyncCompletionRulesContract;
	private readonly _setup_rules: JestSetupRulesContract;
	private readonly _stage_timer: LintStageTimerContract;
	private readonly _violations: ViolationContract[];

	/** Responsibilities: _suite size_, _test count_. **/
	private append_suite_limits(suite: JestSuite): void {
		const line = this._source_file.getLineAndCharacterOfPosition(suite.node.getStart(this._source_file)).line + 1;
		const count = this._test_ending_rule.test_count(suite.tests);
		if (count < MIN_TESTS_PER_SUITE) {
			this._violations.push(this._count_rules.first.violation(this._file, line, { count: String(count) }));
		} else if (count > MAX_TESTS_PER_SUITE) {
			this._violations.push(this._count_rules.second.violation(this._file, line, { count: String(count) }));
		}
		const size = this._test_size.suite(suite);
		if (size < MIN_CLASS_LINES) {
			this._violations.push(this._suite_size_rules.first.violation(this._file, line, { size: String(size) }));
		}
		if (size > MAX_CLASS_LINES) {
			this._violations.push(this._suite_size_rules.second.violation(this._file, line, { size: String(size) }));
		}
	}

	/** Responsibilities: _test callback size findings_. **/
	private append_test_sizes(): void {
		for (const test of this._suite_tests) {
			this._suite_collector.with_callback(test, (callback) => {
				if (callback.body === undefined) {
					return;
				}
				const size = this._test_size.test_body(callback.body);
				const line = this._source_file.getLineAndCharacterOfPosition(test.getStart(this._source_file)).line + 1;
				if (size < MIN_TEST_LINES) {
					this._violations.push(this._test_size_rules.first.violation(this._file, line, {}));
				}
				if (size > MAX_TEST_LINES) {
					this._violations.push(this._test_size_rules.second.violation(this._file, line, {}));
				}
			});
		}
	}

	/** Responsibilities: _top-level structure_, _nested suite policy_. **/
	private append_suite_structure(suites: JestSuite[]): void {
		const top_level = suites.filter((suite) => !suite.nested);
		if (top_level.length !== 1) {
			this._violations.push(this._suite_rules.first.violation(this._file, 1, { count: String(top_level.length) }));
		}
		for (const suite of suites.filter((candidate) => candidate.nested)) {
			const line = this._source_file.getLineAndCharacterOfPosition(suite.node.getStart(this._source_file)).line + 1;
			this._violations.push(this._suite_rules.second.violation(this._file, line, {}));
		}
	}

	/** Responsibilities: _Jest suite policy initialization_. **/
	public constructor(options: JestTestSuitePolicyOptions) {
		const { file, source_file, suite_collector, expect_aliases, suites, bindings, stage_timer, inline_objects } =
			options;
		this._file = file;
		this._violations = [];
		this._source_file = source_file;
		this._stage_timer = stage_timer;
		this._expect_aliases = expect_aliases;
		this._suite_collector = suite_collector;
		this._suite_tests = suites.flatMap((suite) => suite.tests);
		this._count_rules = {
			first: new DiagnosticRule("test-min-count"),
			second: new DiagnosticRule("test-max-count"),
		};
		this._suite_size_rules = {
			first: new DiagnosticRule("typescript-jest-min-size"),
			second: new DiagnosticRule("typescript-jest-max-size"),
		};
		this._test_size_rules = {
			first: new DiagnosticRule("test-min-size"),
			second: new DiagnosticRule("test-max-size"),
		};
		this._test_ending_rule = new JestTestEndingRule(expect_aliases);
		this._inline_objects = inline_objects;
		this._test_ending_diagnostic = new DiagnosticRule("typescript-jest-test-ending");
		this._suite_rules = {
			first: new DiagnosticRule("typescript-jest-describe-count"),
			second: new DiagnosticRule("typescript-jest-nested-describe"),
		};
		this._test_size = new JestTestSize(source_file, this._suite_collector, this._test_ending_rule);
		this._async_completion = new JestAsyncCompletionRules(this._suite_collector, bindings);
		this._setup_rules = new JestSetupRules(this._suite_collector, this._test_size, file, source_file);
	}

	/** Responsibilities: _suite shape_, _test callback rules_. **/
	public append_suite(suite: JestSuite): void {
		this.append_suite_limits(suite);
		const shape = new JestTestShapeViolations(this._file, this._source_file, suite.tests, this._expect_aliases);
		this._violations.push(
			...shape.shape_diagnostics(),
			...shape.result_diagnostics(),
			...shape.assertion_diagnostics(),
		);
		this._violations.push(...this._setup_rules.append_duplicate_setup(suite.tests));
		this._violations.push(...this._inline_objects.append_suite(suite));
		this._async_completion.append(this._violations, this._file, this._source_file, suite.tests);
	}

	/** Responsibilities: _aggregate suite policy findings_. **/
	public append_violations(suites: JestSuite[], violations: ViolationContract[]): void {
		this._violations.length = 0;
		violations.push(
			...this._stage_timer.measure("rule.fixture-complexity.typescript", () => this._setup_rules.fixture_complexity()),
		);
		this.append_suite_structure(suites);
		this.append_test_sizes();
		for (const line of this._test_ending_rule.invalid_test_lines(this._source_file, this._suite_tests)) {
			this._violations.push(this._test_ending_diagnostic.violation(this._file, line, {}));
		}
		for (const suite of suites) {
			this.append_suite(suite);
		}
		violations.push(...this._violations);
	}
}
