import ts from "typescript";
import { JestTestEndingRule } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/assertions/jest_test_ending_rule";
import { JestTestShapeViolations } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_test_shape_violations";
import { JestSuiteCollector } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_suite_collector";
import { JestTestSize } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_test_size";
import { JestModuleState } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_module_state";
import { JestAsyncCompletionRules } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_async_completion_rules";
import { JestSetupRules } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_setup_rules";
import type { JestSuite } from "src/types";
import type { JestTestRulesContract, JestTestShapeViolationsContract, JestTestSizeContract, JestAsyncCompletionRulesContract, JestBindingIndexContract, JestSuiteCollectorContract, JestSetupRulesContract } from "src/testing_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import {
	MAX_CLASS_LINES,
	MAX_TESTS_PER_SUITE,
	MIN_TESTS_PER_SUITE,
	MAX_TEST_LINES,
	MIN_CLASS_LINES,
	MIN_TEST_LINES,
	TYPESCRIPT_TEST_SUFFIXES,
} from "src/constants";
import { JestBindingIndex } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_binding_index";
import { JestExecutionRegion } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_execution_region";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import { TestPathSyntax } from "src/test_path_syntax";
import { JestTestProductionUsage } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_test_production_usage";

/** Responsibilities: _Jest test policy checks_, _test structure diagnostics_. **/
export class JestTestRules implements JestTestRulesContract {
	private readonly suite_collector: JestSuiteCollectorContract;
	private readonly test_size: JestTestSizeContract;
	private readonly min_count_rule: DiagnosticRule;
	private readonly max_count_rule: DiagnosticRule;
	private readonly min_size_rule: DiagnosticRule;
	private readonly max_size_rule: DiagnosticRule;
	private readonly max_test_rule: DiagnosticRule;
	private readonly min_test_rule: DiagnosticRule;
	private readonly test_ending_rule: JestTestEndingRule;
	private readonly test_ending_diagnostic: DiagnosticRule;
	private readonly shape_violations: JestTestShapeViolationsContract;
	private readonly describe_count_rule: DiagnosticRule;
	private readonly nested_describe_rule: DiagnosticRule;
	private readonly time_dependency_rule: DiagnosticRule;
	private readonly order_dependency_rule: DiagnosticRule;
	private readonly async_completion: JestAsyncCompletionRulesContract;
	private readonly module_state: JestModuleState;
	private readonly setup_rules: JestSetupRulesContract;
	private readonly production_usage: JestTestProductionUsage;
	private readonly test_path_syntax: TestPathSyntax;

	/** Responsibilities: _test time dependency identification_. **/
	private uncontrolled_time(node: ts.Node): boolean {
		if (ts.isNewExpression(node)) {
			return node.expression.getText() === "Date";
		}
		if (!ts.isCallExpression(node)) {
			return false;
		}
		const expression = node.expression.getText();
		return expression === "Date.now" || expression === "Math.random";
	}

	/** Responsibilities: _test uncontrolled time diagnostics_. **/
	private append_time_dependencies(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void {
		for (const test of tests) {
			this.suite_collector.with_callback(test, (callback) => {
				if (callback.body === undefined) {
					return;
				}
				const region = new JestExecutionRegion(callback.body, (node) => {
					if (this.uncontrolled_time(node)) {
						const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1;
						violations.push(this.time_dependency_rule.violation(file, line));
					}
				});
				region.visit();
			});
		}
	}

	/** Responsibilities: _test-order dependency diagnostics_. **/
	private append_test_mutations(
		test_writes: Map<string, number>,
		test: ts.CallExpression,
		bindings: JestBindingIndexContract,
		module_declarations: ReadonlySet<ts.Declaration>,
	): void {
		this.suite_collector.with_callback(test, (callback) => {
			if (callback.body === undefined) {
				return;
			}
			for (const name of this.module_state.mutations(callback.body, bindings, module_declarations)) {
				const current_count = test_writes.get(name);
				if (current_count === undefined) {
					test_writes.set(name, 1);
					continue;
				}
				test_writes.set(name, current_count + 1);
			}
		});
	}

	/** Responsibilities: _test-order dependency diagnostics_. **/
	private append_order_dependencies(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void {
		const bindings = new JestBindingIndex(source_file);
		const module_declarations = this.module_state.declarations(source_file);
		const test_writes = new Map<string, number>();
		for (const test of tests) {
			this.append_test_mutations(test_writes, test, bindings, module_declarations);
		}
		for (const [name, count] of test_writes) {
			if (count > 1) {
				violations.push(this.order_dependency_rule.violation(file, 1, { name }));
			}
		}
	}

	/** Responsibilities: _test violation count addition_. **/
	private append_count(violations: ViolationContract[], file: string, line: number, count: number): void {
		if (count < MIN_TESTS_PER_SUITE) {
			violations.push(this.min_count_rule.violation(file, line, { count: String(count) }));
			return;
		}
		if (count > MAX_TESTS_PER_SUITE) {
			violations.push(this.max_count_rule.violation(file, line, { count: String(count) }));
		}
	}

	/** Responsibilities: _size violations addition testing_. **/
	private append_size(violations: ViolationContract[], file: string, line: number, size: number): void {
		if (size < MIN_CLASS_LINES) {
			violations.push(this.min_size_rule.violation(file, line, { size: String(size) }));
		}
		if (size > MAX_CLASS_LINES) {
			violations.push(this.max_size_rule.violation(file, line, { size: String(size) }));
		}
	}

	/** Responsibilities: _aggregation individual test size_. **/
	private append_test_sizes(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void {
		for (const test of tests) {
			this.suite_collector.with_callback(test, (callback) => {
				if (callback.body === undefined) {
					return;
				}
				const size = this.test_size.test_body(callback.body);
				if (size < MIN_TEST_LINES) {
					violations.push(this.min_test_rule.violation(file, this.suite_line(source_file, test)));
				}
				if (size > MAX_TEST_LINES) {
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
		violations: ViolationContract[],
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
		violations: ViolationContract[],
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
		violations: ViolationContract[],
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
		violations: ViolationContract[],
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
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		suite: JestSuite,
	): void {
		this.append_suite_limits(violations, file, source_file, suite);
		this.append_suite_shape(violations, file, source_file, suite.tests);
		this.append_test_end(violations, file, source_file, suite.tests);
		this.append_time_dependencies(violations, file, source_file, suite.tests);
		this.append_order_dependencies(violations, file, source_file, suite.tests);
		this.setup_rules.append_duplicate_setup(violations, file, source_file, suite.tests);
		this.async_completion.append(violations, file, source_file, suite.tests);
	}

	/** Responsibilities: _Jest test composition_. **/
	public constructor() {
		this.test_path_syntax = new TestPathSyntax();
		this.suite_collector = new JestSuiteCollector();
		this.min_count_rule = new DiagnosticRule("test-min-count");
		this.max_count_rule = new DiagnosticRule("test-max-count");
		this.min_size_rule = new DiagnosticRule("typescript-jest-min-size");
		this.max_size_rule = new DiagnosticRule("typescript-jest-max-size");
		this.max_test_rule = new DiagnosticRule("test-max-size");
		this.min_test_rule = new DiagnosticRule("test-min-size");
		this.test_ending_rule = new JestTestEndingRule();
		this.test_ending_diagnostic = new DiagnosticRule("typescript-jest-test-ending");
		this.describe_count_rule = new DiagnosticRule("typescript-jest-describe-count");
		this.nested_describe_rule = new DiagnosticRule("typescript-jest-nested-describe");
		this.time_dependency_rule = new DiagnosticRule("test-time-dependency");
		this.order_dependency_rule = new DiagnosticRule("test-order-dependency");
		this.module_state = new JestModuleState();
		this.test_size = new JestTestSize();
		this.shape_violations = new JestTestShapeViolations();
		this.async_completion = new JestAsyncCompletionRules(this.suite_collector);
		this.setup_rules = new JestSetupRules(this.suite_collector, this.test_size);
		this.production_usage = new JestTestProductionUsage(this.suite_collector, this.test_path_syntax);
	}

	/** Responsibilities: _aggregation Jest violations source_. **/
	public append_violations(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		resolver: TypeScriptModuleResolverContract,
	): void {
		if (!this.jest_file(file)) {
			return;
		}
		this.setup_rules.append_fixture_complexity(violations, file, source_file);
		const suites = this.suite_collector.suites(source_file);
		this.production_usage.append(
			violations,
			file,
			source_file,
			suites.flatMap((suite) => suite.tests),
			resolver,
		);
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
