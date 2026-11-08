import { TEST_PATH_SUFFIXES } from "src/constants";
import {
	JEST_DESCRIBE_NAME,
	MAX_CLASS_LINES,
	MAX_TESTS_PER_SUITE,
	MAX_TEST_LINES,
	MIN_CLASS_LINES,
	MIN_TESTS_PER_SUITE,
	MIN_TEST_LINES,
} from "src/constants";
import type { JestSuite } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { JestTestEndingRule } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/assertions/jest_test_ending_rule";
import { JestAsyncCompletionRules } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_async_completion_rules";
import { JestExecutionDependencyRules } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_execution_dependency_rules";
import { JestSetupRules } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_setup_rules";
import { JestSuiteCollector } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_suite_collector";
import { JestTestProductionUsage } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_test_production_usage";
import { JestTestShapeViolations } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_test_shape_violations";
import { JestTestSize } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_test_size";
import type { TestPathSyntaxContract } from "src/shared_services_protocols";
import { TestPathSyntax } from "src/test_path_syntax";
import type {
	JestAsyncCompletionRulesContract,
	JestBindingIndexContract,
	JestSetupRulesContract,
	JestSuiteCollectorContract,
	JestTestRulesContract,
	JestTestSizeContract,
} from "src/testing_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type ts from "typescript";

/** Responsibilities: _Jest test policy checks_, _test structure diagnostics_. **/
export class JestTestRules implements JestTestRulesContract {
	private readonly _file: string;
	private readonly _source_file: ts.SourceFile;
	private readonly _suite_collector: JestSuiteCollectorContract;
	private readonly _suites: JestSuite[];
	private readonly _suite_tests: ts.CallExpression[];
	private readonly _test_size: JestTestSizeContract;
	private readonly _min_count_rule: RuleContract;
	private readonly _max_count_rule: RuleContract;
	private readonly _min_size_rule: RuleContract;
	private readonly _max_size_rule: RuleContract;
	private readonly _max_test_rule: RuleContract;
	private readonly _min_test_rule: RuleContract;
	private readonly _test_ending_rule: JestTestEndingRule;
	private readonly _test_ending_diagnostic: RuleContract;
	private readonly _expect_aliases: TypeScriptExpressionAliasesContract;
	private readonly _describe_count_rule: RuleContract;
	private readonly _nested_describe_rule: RuleContract;
	private readonly _async_completion: JestAsyncCompletionRulesContract;
	private readonly _execution_dependency_rules: JestExecutionDependencyRules;
	private readonly _setup_rules: JestSetupRulesContract;
	private readonly _test_path_syntax: TestPathSyntaxContract;

	/** Responsibilities: _test violation count addition_. **/
	private count_violations(line: number, count: number): ViolationContract[] {
		if (count < MIN_TESTS_PER_SUITE) {
			return [this._min_count_rule.violation(this._file, line, { count: String(count) })];
		}
		if (count > MAX_TESTS_PER_SUITE) {
			return [this._max_count_rule.violation(this._file, line, { count: String(count) })];
		}
		return [];
	}

	/** Responsibilities: _size violations addition testing_. **/
	private size_violations(line: number, size: number): ViolationContract[] {
		const violations: ViolationContract[] = [];
		if (size < MIN_CLASS_LINES) {
			violations.push(this._min_size_rule.violation(this._file, line, { size: String(size) }));
		}
		if (size > MAX_CLASS_LINES) {
			violations.push(this._max_size_rule.violation(this._file, line, { size: String(size) }));
		}
		return violations;
	}

	/** Responsibilities: _aggregation individual test size_. **/
	private test_size_violations(): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const test of this._suite_tests) {
			this._suite_collector.with_callback(test, (callback) => {
				if (callback.body === undefined) {
					return;
				}
				const size = this._test_size.test_body(callback.body);
				if (size < MIN_TEST_LINES) {
					violations.push(this._min_test_rule.violation(this._file, this.suite_line(test), {}));
				}
				if (size > MAX_TEST_LINES) {
					violations.push(this._max_test_rule.violation(this._file, this.suite_line(test), {}));
				}
			});
		}
		return violations;
	}

	/** Responsibilities: _resolution Jest suite line_. **/
	private suite_line(node: ts.CallExpression): number {
		const position = node.getStart(this._source_file);
		const character = this._source_file.getLineAndCharacterOfPosition(position);
		return character.line + 1;
	}

	/** Responsibilities: _aggregation Jest suite structure_. **/
	private structure_violations(suites: JestSuite[]): ViolationContract[] {
		const violations: ViolationContract[] = [];
		const top_level_suites = suites.filter((suite) => !suite.nested);
		if (top_level_suites.length !== 1) {
			violations.push(
				this._describe_count_rule.violation(this._file, 1, {
					count: String(top_level_suites.length),
				}),
			);
		}
		for (const suite of suites.filter((candidate) => candidate.nested)) {
			violations.push(this._nested_describe_rule.violation(this._file, this.suite_line(suite.node), {}));
		}
		return violations;
	}

	/** Responsibilities: _test-ending violations addition_. **/
	private test_end_violations(): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const line of this._test_ending_rule.invalid_test_lines(this._source_file, this._suite_tests)) {
			violations.push(this._test_ending_diagnostic.violation(this._file, line, {}));
		}
		return violations;
	}

	/** Responsibilities: _aggregation violations Jest suite_. **/
	private suite_limit_violations(suite: JestSuite): ViolationContract[] {
		const line = this.suite_line(suite.node);
		return [
			...this.count_violations(line, this._test_ending_rule.test_count(suite.tests)),
			...this.size_violations(line, this._test_size.suite(suite)),
		];
	}

	/** Responsibilities: _Jest suite diagnostics aggregation_. **/
	private suite_violations(suite: JestSuite): ViolationContract[] {
		const violations = this.suite_limit_violations(suite);
		const shape_violations = new JestTestShapeViolations(
			this._file,
			this._source_file,
			suite.tests,
			this._expect_aliases,
		);
		violations.push(
			...shape_violations.shape_diagnostics(),
			...shape_violations.result_diagnostics(),
			...shape_violations.assertion_diagnostics(),
		);
		violations.push(...this._setup_rules.append_duplicate_setup(suite.tests));
		this._async_completion.append(violations, this._file, this._source_file, suite.tests);
		return violations;
	}

	/** Responsibilities: _fixture complexity_, _production behavior validation_. **/
	private production_usage_violations(
		suites: JestSuite[],
		resolver: TypeScriptModuleResolverContract,
	): ViolationContract[] {
		const violations: ViolationContract[] = [];
		violations.push(...this._setup_rules.fixture_complexity());
		const production_usage = new JestTestProductionUsage(
			this._suite_collector,
			this._test_path_syntax,
			this._file,
			this._source_file,
			resolver,
		);
		production_usage.append(
			violations,
			suites.flatMap((suite) => suite.tests),
		);
		return violations;
	}

	/** Responsibilities: _Jest test composition_. **/
	public constructor(file: string, source_file: ts.SourceFile, bindings: JestBindingIndexContract) {
		this._file = file;
		this._source_file = source_file;
		this._test_path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		const declaration_index = new TypeScriptObjectAliasDeclarationIndex();
		const expect_aliases = new TypeScriptExpressionAliases("expect", declaration_index);
		this._expect_aliases = expect_aliases;
		this._suite_collector = new JestSuiteCollector(
			new TypeScriptExpressionAliases(JEST_DESCRIBE_NAME, declaration_index),
			new TypeScriptExpressionAliases("test", declaration_index),
			new TypeScriptExpressionAliases("it", declaration_index),
		);
		const suites = this._suite_collector.suites(source_file);
		this._suites = suites;
		this._suite_tests = suites.flatMap((suite) => suite.tests);
		this._min_count_rule = new DiagnosticRule("test-min-count");
		this._max_count_rule = new DiagnosticRule("test-max-count");
		this._min_size_rule = new DiagnosticRule("typescript-jest-min-size");
		this._max_size_rule = new DiagnosticRule("typescript-jest-max-size");
		this._max_test_rule = new DiagnosticRule("test-max-size");
		this._min_test_rule = new DiagnosticRule("test-min-size");
		this._test_ending_rule = new JestTestEndingRule(expect_aliases);
		this._test_ending_diagnostic = new DiagnosticRule("typescript-jest-test-ending");
		this._describe_count_rule = new DiagnosticRule("typescript-jest-describe-count");
		this._nested_describe_rule = new DiagnosticRule("typescript-jest-nested-describe");
		this._test_size = new JestTestSize(source_file, this._suite_collector, this._test_ending_rule);
		this._async_completion = new JestAsyncCompletionRules(this._suite_collector, bindings);
		this._setup_rules = new JestSetupRules(this._suite_collector, this._test_size, this._file, this._source_file);
		this._execution_dependency_rules = new JestExecutionDependencyRules(
			this._file,
			this._source_file,
			this._suite_collector,
			this._suite_tests,
			bindings,
		);
	}

	/** Responsibilities: _aggregation Jest violations source_. **/
	public append_violations(violations: ViolationContract[], resolver: TypeScriptModuleResolverContract): void {
		const suites = this._suites;
		const collected = this.production_usage_violations(suites, resolver);
		collected.push(...this.structure_violations(suites));
		collected.push(...this.test_size_violations(), ...this.test_end_violations());
		collected.push(
			...this._execution_dependency_rules.time_dependency_violations(),
			...this._execution_dependency_rules.order_dependency_violations(),
		);
		for (const suite of suites) {
			collected.push(...this.suite_violations(suite));
		}
		violations.push(...collected);
	}
}
