import { MAX_TESTS_PER_SUITE, MAX_TEST_LINES, MIN_TESTS_PER_SUITE, MIN_TEST_LINES } from "src/constants";
import { PYTHON_TESTCASE_BASE, PYTHON_UNITTEST_FRAMEWORK } from "src/constants";
import { PythonTestMethodAssertions } from "src/linting/orchestration/runtime/python/coding_rules/python_test_method_assertions";
import { PythonTestProductionUsage } from "src/linting/orchestration/runtime/python/coding_rules/python_test_production_usage";
import { PythonTestFrameworkIdentity } from "src/linting/orchestration/runtime/test-targets/python_test_framework_identity";
import type { PythonRuleInput } from "src/linting/types";
import type { AstCallableNode, AstClassNode } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { PythonTestRuleCollectorContract } from "src/python_protocols";
import type { RuleContract } from "src/reporting_protocols";

/** Responsibilities: _Python test assertion checks_, _production usage checks_. **/
export class PythonTestRuleCollector implements PythonTestRuleCollectorContract {
	private readonly _input: PythonRuleInput;
	private readonly _inheritance_rule: RuleContract;
	private readonly _production_usage: PythonTestProductionUsage;
	private readonly _min_size_rule: RuleContract;
	private readonly _max_size_rule: RuleContract;
	private readonly _min_count_rule: RuleContract;
	private readonly _max_count_rule: RuleContract;
	private readonly _framework_identity: PythonTestFrameworkIdentity;

	/** Responsibilities: _test callable size diagnostics_. **/
	private append_test_size(test: AstCallableNode): void {
		const size = test.metrics.sloc;
		if (size < MIN_TEST_LINES) {
			this._input.violations.push(
				this._min_size_rule.violation(this._input.file_name.value(), test.identity.start + 1, {}),
			);
		}
		if (size > MAX_TEST_LINES) {
			this._input.violations.push(
				this._max_size_rule.violation(this._input.file_name.value(), test.identity.start + 1, {}),
			);
		}
	}

	/** Responsibilities: _test callable size collection_. **/
	private append_test_sizes(): void {
		const { classes } = this._input.source;
		for (const class_node of classes.filter((node) => this.is_unittest_class(node))) {
			for (const test of class_node.structure.methods.filter((node) => node.identity.name.startsWith("test_"))) {
				if (!test.declaration.decorators.includes("fixture")) {
					this.append_test_size(test);
				}
			}
		}
	}

	/** Responsibilities: _class test counts_. **/
	private append_test_count(class_node: AstClassNode): void {
		const test_methods = class_node.structure.methods.filter(
			(node) => node.identity.name.startsWith("test_") && !node.declaration.decorators.includes("fixture"),
		);
		const test_count = this.test_case_count(test_methods);
		if (test_count === 0) {
			return;
		}
		const violations = this._input.violations;
		const file_name = this._input.file_name;
		const line = class_node.identity.start + 1;
		const count = String(test_count);
		if (test_count < MIN_TESTS_PER_SUITE) {
			violations.push(this._min_count_rule.violation(file_name.value(), line, { count }));
		}
		if (test_count > MAX_TESTS_PER_SUITE) {
			violations.push(this._max_count_rule.violation(file_name.value(), line, { count }));
		}
	}

	/** Responsibilities: _parameterized test case count_. **/
	private test_case_count(test_methods: AstCallableNode[]): number {
		return test_methods.reduce((count, method) => {
			if (!method.declaration.decorators.includes("expand")) {
				return count + 1;
			}
			return count + method.declaration.parameterized_case_count;
		}, 0);
	}

	/** Responsibilities: _unittest class identity_. **/
	private is_unittest_class(class_node: AstClassNode): boolean {
		let base_count = 0;
		let unittest_base = false;
		for (const base_class_name of class_node.structure.base_class_names) {
			base_count += 1;
			unittest_base = this._framework_identity.resolve(base_class_name) === PYTHON_TESTCASE_BASE;
		}
		return base_count === 1 && unittest_base;
	}

	/** Responsibilities: _test-class inheritance violations addition_. **/
	private append_inheritance(): void {
		for (const node of this._input.source.classes) {
			const has_test_method = node.structure.methods.some(
				(method) => method.identity.name.startsWith("test_") && !method.declaration.decorators.includes("fixture"),
			);
			if (has_test_method && !this.is_unittest_class(node)) {
				this._input.violations.push(
					this._inheritance_rule.violation(this._input.file_name.value(), node.identity.start + 1, {}),
				);
			}
		}
	}

	/** Responsibilities: _unittest class test counts_. **/
	private append_test_counts(): void {
		for (const class_node of this._input.source.classes) {
			if (this.is_unittest_class(class_node)) {
				this.append_test_count(class_node);
			}
		}
	}

	/** Responsibilities: _module-level test shape violations_. **/
	private append_function_shape(): void {
		const { file_name, operations } = this._input;
		const rule = new DiagnosticRule("python-test-shape");
		for (const node of operations.functions) {
			if (node.identity.name.startsWith("test_") && !node.declaration.decorators.includes("fixture")) {
				this._input.violations.push(rule.violation(file_name.value(), node.identity.start + 1, {}));
			}
		}
	}

	/** Responsibilities: _initialization Python test rule_. **/
	public constructor(input: PythonRuleInput) {
		this._inheritance_rule = new DiagnosticRule("python-test-class-inheritance");
		this._production_usage = new PythonTestProductionUsage(input);
		this._min_size_rule = new DiagnosticRule("test-min-size");
		this._max_size_rule = new DiagnosticRule("test-max-size");
		this._min_count_rule = new DiagnosticRule("test-min-count");
		this._max_count_rule = new DiagnosticRule("test-max-count");
		this._framework_identity = new PythonTestFrameworkIdentity(
			input.source.reference_aliases,
			input.source.python_imports,
		);
		this._input = input;
	}

	/** Responsibilities: _Python test shape diagnostics_. **/
	public append_shape(): void {
		const file_name = this._input.file_name;
		if (!file_name.test() || !file_name.value().endsWith(".py")) {
			return;
		}
		this.append_test_sizes();
		this.append_test_counts();
		this.append_function_shape();
		this.append_inheritance();
		this._production_usage.append(this._production_usage.test_callables());
	}

	/** Responsibilities: _aggregation assertion grouping complexity_. **/
	public append_assertions(): void {
		const { classes, python_imports } = this._input.source;
		const unittest_enabled = python_imports.some((item) => item.module === PYTHON_UNITTEST_FRAMEWORK);
		for (const node of classes) {
			for (const method of node.structure.methods) {
				const assertions = new PythonTestMethodAssertions(this._input, method);
				assertions.append_exception_bypass();
				if (unittest_enabled) {
					assertions.append_unittest_assertions();
				}
			}
		}
	}
}
