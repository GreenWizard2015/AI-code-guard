import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { PythonTestRuleCollectorContract } from "src/python_protocols";
import type { RuleContract, ViolationContract } from "src/reporting_protocols";
import type { AstCallableNodeContract, AstClassNode, NamedLine } from "src/types";
import type { PythonRuleInput } from "src/linting/types";
import {
	MAX_TEST_ASSERTIONS,
	MAX_TEST_LINES,
	MAX_TESTS_PER_SUITE,
	MIN_TEST_LINES,
	MIN_TESTS_PER_SUITE,
} from "src/constants";
import { PYTHON_UNITTEST_FRAMEWORK } from "src/constants";
import { PythonTestFrameworkIdentity } from "src/linting/orchestration/runtime/test-targets/python_test_framework_identity";

/** Responsibilities: _Python test assertion checks_, _production usage checks_. **/
export class PythonTestRuleCollector implements PythonTestRuleCollectorContract {
	private readonly input: PythonRuleInput;
	private readonly assertion_rule: DiagnosticRule;
	private readonly assertion_alias_rule: DiagnosticRule;
	private readonly ending_rule: DiagnosticRule;
	private readonly grouping_rule: DiagnosticRule;
	private readonly complexity_rule: DiagnosticRule;
	private readonly exception_only_rule: DiagnosticRule;
	private readonly inheritance_rule: DiagnosticRule;
	private readonly production_usage_rule: DiagnosticRule;
	private readonly min_size_rule: DiagnosticRule;
	private readonly max_size_rule: DiagnosticRule;
	private readonly min_count_rule: DiagnosticRule;
	private readonly max_count_rule: DiagnosticRule;
	private readonly framework_identity: PythonTestFrameworkIdentity;

	/** Responsibilities: _test callable size diagnostics_. **/
	private append_test_size(violations: ViolationContract[], file: string, test: AstCallableNodeContract): void {
		const size = test.sloc;
		if (size < MIN_TEST_LINES) {
			violations.push(this.min_size_rule.violation(file, test.start + 1));
		}
		if (size > MAX_TEST_LINES) {
			violations.push(this.max_size_rule.violation(file, test.start + 1));
		}
	}

	/** Responsibilities: _test callable size collection_. **/
	private append_test_sizes(): void {
		const { violations, file_name, classes } = this.input;
		for (const class_node of classes.filter((node) => this.is_unittest_class(node))) {
			for (const test of class_node.methods.filter((node) => node.name.startsWith("test_"))) {
				if (!test.decorators.includes("fixture")) {
					this.append_test_size(violations, file_name.value, test);
				}
			}
		}
	}

	/** Responsibilities: _class test counts_. **/
	private append_test_count(class_node: AstClassNode): void {
		const test_methods = class_node.methods.filter(
			(node) => node.name.startsWith("test_") && !node.decorators.includes("fixture"),
		);
		if (test_methods.length === 0) {
			return;
		}
		const { violations, file_name } = this.input;
		const line = class_node.start + 1;
		const count = String(test_methods.length);
		if (test_methods.length < MIN_TESTS_PER_SUITE) {
			violations.push(this.min_count_rule.violation(file_name.value, line, { count }));
		}
		if (test_methods.length > MAX_TESTS_PER_SUITE) {
			violations.push(this.max_count_rule.violation(file_name.value, line, { count }));
		}
	}

	/** Responsibilities: _unittest class identity_. **/
	private is_unittest_class(class_node: AstClassNode): boolean {
		let base_count = 0;
		let unittest_base = false;
		for (const base_class_name of class_node.base_class_names) {
			base_count += 1;
			unittest_base = this.framework_identity.unittest_base(base_class_name);
		}
		return base_count === 1 && unittest_base;
	}

	/** Responsibilities: _aggregation assertion-shape violations callable_. **/
	private append_assertion(
		violations: ViolationContract[],
		file: string,
		method: AstCallableNodeContract,
		assertion_rule: RuleContract,
		ending_rule: RuleContract,
	): void {
		if (!method.name.startsWith("test_") || method.decorators.includes("fixture")) {
			return;
		}
		if (method.has_unittest_assertion !== true) {
			violations.push(assertion_rule.violation(file, method.start + 1, {}));
		}
		if (method.has_unittest_assertion === true && method.unittest_ending_valid !== true) {
			violations.push(ending_rule.violation(file, method.start + 1, {}));
		}
	}

	/** Responsibilities: _aggregation assertion grouping violations_. **/
	private append_grouping(
		violations: ViolationContract[],
		file: string,
		method: AstCallableNodeContract,
		rule: RuleContract,
	): void {
		if (method.unittest_assertion_count >= 3) {
			violations.push(rule.violation(file, method.start + 1, {}));
		}
	}

	/** Responsibilities: _aggregation complexity violations callable_. **/
	private append_complexity(
		violations: ViolationContract[],
		file: string,
		method: AstCallableNodeContract,
		rule: RuleContract,
	): void {
		if (!method.name.startsWith("test_") || method.decorators.includes("fixture")) {
			return;
		}
		if (method.unittest_assertion_count > MAX_TEST_ASSERTIONS) {
			violations.push(rule.violation(file, method.start + 1, {}));
		}
	}

	/** Responsibilities: _application assertion rules methods_. **/
	private append_method_assertions(
		violations: ViolationContract[],
		file: string,
		method: AstCallableNodeContract,
	): void {
		this.append_assertion(violations, file, method, this.assertion_rule, this.ending_rule);
		if (!method.name.startsWith("test_")) {
			return;
		}
		if (method.decorators.includes("fixture")) {
			return;
		}
		if (method.unittest_exception_only === true) {
			violations.push(this.exception_only_rule.violation(file, method.start + 1));
		}
		if (method.unittest_assertion_alias === true) {
			violations.push(this.assertion_alias_rule.violation(file, method.start + 1));
		}
		this.append_grouping(violations, file, method, this.grouping_rule);
	}

	/** Responsibilities: _aggregation exception assertion bypass_. **/
	private append_exception_bypass(
		violations: ViolationContract[],
		file: string,
		method: AstCallableNodeContract,
	): void {
		if (!method.name.startsWith("test_")) {
			return;
		}
		if (method.decorators.includes("fixture")) {
			return;
		}
		if (method.test_exception_bypass === true) {
			violations.push(this.exception_only_rule.violation(file, method.start + 1));
		}
	}

	/** Responsibilities: _test-class inheritance violations addition_. **/
	private append_inheritance(violations: ViolationContract[]): void {
		for (const node of this.input.classes) {
			const has_test_method = node.methods.some(
				(method) => method.name.startsWith("test_") && !method.decorators.includes("fixture"),
			);
			if (has_test_method && !this.is_unittest_class(node)) {
				violations.push(this.inheritance_rule.violation(this.input.file_name.value, node.start + 1));
			}
		}
	}

	/** Responsibilities: _per-test production behavior verification_. **/
	private reference_in_test(
		reference: NamedLine,
		test: AstCallableNodeContract,
		production_import_names: ReadonlySet<string>,
	): boolean {
		if (reference.line < test.start + 1) {
			return false;
		}
		if (reference.line > test.end + 1) {
			return false;
		}
		return production_import_names.has(reference.name);
	}

	/** Responsibilities: _per-test production behavior verification_. **/
	private append_production_usage(): void {
		const { violations, file_name, classes, operations, production_import_names } = this.input;
		const tests = [
			...operations.functions.filter((node) => node.name.startsWith("test_") && !node.decorators.includes("fixture")),
			...classes
				.flatMap((node) => node.methods)
				.filter((node) => node.name.startsWith("test_") && !node.decorators.includes("fixture")),
		];
		for (const test of tests) {
			const used = operations.symbol_references.some((reference) =>
				this.reference_in_test(reference, test, production_import_names),
			);
			if (!used) {
				violations.push(this.production_usage_rule.violation(file_name.value, test.start + 1));
			}
		}
	}

	/** Responsibilities: _initialization Python test rule_. **/
	public constructor(input: PythonRuleInput) {
		this.assertion_rule = new DiagnosticRule("python-test-assert");
		this.assertion_alias_rule = new DiagnosticRule("python-test-assertion-alias");
		this.ending_rule = new DiagnosticRule("python-test-assert-ending");
		this.grouping_rule = new DiagnosticRule("test-assertion-grouping");
		this.complexity_rule = new DiagnosticRule("test-too-many-assertions");
		this.exception_only_rule = new DiagnosticRule("test-exception-only");
		this.inheritance_rule = new DiagnosticRule("python-test-class-inheritance");
		this.production_usage_rule = new DiagnosticRule("test-production-usage");
		this.min_size_rule = new DiagnosticRule("test-min-size");
		this.max_size_rule = new DiagnosticRule("test-max-size");
		this.min_count_rule = new DiagnosticRule("test-min-count");
		this.max_count_rule = new DiagnosticRule("test-max-count");
		this.framework_identity = new PythonTestFrameworkIdentity(input.reference_aliases, input.python_imports);
		this.input = input;
	}

	/** Responsibilities: _Python test shape diagnostics_. **/
	public append_shape(): void {
		const { violations, file_name, operations } = this.input;
		if (!file_name.test() || !file_name.value.endsWith(".py")) {
			return;
		}
		this.append_test_sizes();
		for (const class_node of this.input.classes.filter((node) => this.is_unittest_class(node))) {
			this.append_test_count(class_node);
		}
		const rule = new DiagnosticRule("python-test-shape");
		violations.push(
			...operations.functions
				.filter((node) => node.name.startsWith("test_") && !node.decorators.includes("fixture"))
				.map((node) => rule.violation(file_name.value, node.start + 1)),
		);
		this.append_inheritance(violations);
		this.append_production_usage();
	}

	/** Responsibilities: _aggregation assertion grouping complexity_. **/
	public append_assertions(): void {
		const { violations, file_name, classes, python_imports } = this.input;
		for (const node of classes) {
			for (const method of node.methods) {
				this.append_exception_bypass(violations, file_name.value, method);
			}
		}
		if (!python_imports.some((item) => item.module === PYTHON_UNITTEST_FRAMEWORK)) {
			return;
		}
		for (const node of classes) {
			for (const method of node.methods) {
				this.append_method_assertions(violations, file_name.value, method);
				this.append_complexity(violations, file_name.value, method, this.complexity_rule);
			}
		}
	}
}
