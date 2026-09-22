import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { Violation } from 'src/protocols';
import type { AstCallableNode } from 'src/types';
import type { PythonRuleInput } from 'src/runner/types';
import { MAX_TEST_ASSERTIONS } from 'src/constants';

/** Responsibilities: _collection Python test assertion_. **/
export class PythonTestRuleCollector {
	private readonly input: PythonRuleInput;
	private readonly assertion_rule = new DiagnosticRule('python-test-assert');
	private readonly ending_rule = new DiagnosticRule('python-test-assert-ending');
	private readonly grouping_rule = new DiagnosticRule('test-assertion-grouping');
	private readonly complexity_rule = new DiagnosticRule('test-too-many-assertions');
	private readonly exception_only_rule = new DiagnosticRule('test-exception-only');
	private readonly inheritance_rule = new DiagnosticRule('python-test-class-inheritance');

	/** Responsibilities: _aggregation assertion-shape violations callable_. **/
	private append_assertion(
		violations: Violation[],
		file: string,
		method: AstCallableNode,
		assertion_rule: DiagnosticRule,
		ending_rule: DiagnosticRule
	): void {
if (!method.name.startsWith('test_') || method.decorators.includes('fixture')) {
			return;
		}
		if (method.has_unittest_assertion !== true) {
			violations.push(assertion_rule.violation(file, method.start + 1));
		}
if (method.has_unittest_assertion === true && method.unittest_ending_valid !== true) {
			violations.push(ending_rule.violation(file, method.start + 1));
		}
	}

	/** Responsibilities: _aggregation assertion grouping violations_. **/
	private append_grouping(
		violations: Violation[],
		file: string,
		method: AstCallableNode,
		rule: DiagnosticRule
	): void {
		if (method.unittest_assertion_count >= 3) {
			violations.push(rule.violation(file, method.start + 1));
		}
	}

	/** Responsibilities: _aggregation complexity violations callable_. **/
	private append_complexity(
		violations: Violation[],
		file: string,
		method: AstCallableNode,
		rule: DiagnosticRule
	): void {
		if (method.unittest_assertion_count > MAX_TEST_ASSERTIONS) {
			violations.push(rule.violation(file, method.start + 1));
		}
	}

	/** Responsibilities: _application assertion rules methods_. **/
	private append_method_assertions(
		violations: Violation[],
		file: string,
		method: AstCallableNode,
	): void {
		this.append_assertion(violations, file, method, this.assertion_rule, this.ending_rule);
		if (!method.name.startsWith('test_')) {
			return;
		}
		if (method.decorators.includes('fixture')) {
			return;
		}
		if (method.unittest_exception_only === true) {
			violations.push(this.exception_only_rule.violation(file, method.start + 1));
		}
		this.append_grouping(violations, file, method, this.grouping_rule);
	}

	/** Responsibilities: _aggregation exception assertion bypass_. **/
	private append_exception_bypass(violations: Violation[], file: string, method: AstCallableNode): void {
		if (!method.name.startsWith('test_')) {
			return;
		}
		if (method.decorators.includes('fixture')) {
			return;
		}
		if (method.test_exception_bypass === true) {
			violations.push(this.exception_only_rule.violation(file, method.start + 1));
		}
	}

	/** Responsibilities: _test-class inheritance violations addition_. **/
	private append_inheritance(violations: Violation[]): void {
		for (const node of this.input.classes) {
			const has_test_method = node.methods.some(method => method.name.startsWith('test_') && !method.decorators.includes('fixture'));
			const valid_inheritance = node.base_class_names.length === 1 && node.base_class_names[0] === 'unittest.TestCase';
			if (has_test_method && !valid_inheritance) {
				violations.push(this.inheritance_rule.violation(this.input.file_name.value, node.start + 1));
			}
		}
	}

	/** Responsibilities: _initialization Python test rule_. **/
	public constructor(input: PythonRuleInput) {
		this.input = input;
	}

	/** Responsibilities: _aggregation test shape ending_. **/
	public append_shape(): void {
		const { violations, file_name, operations } = this.input;
		if (!file_name.test_py()) {
			return;
		}
		const rule = new DiagnosticRule('python-test-shape');
		violations.push(...operations.functions
			.filter(node => node.name.startsWith('test_') && !node.decorators.includes('fixture'))
			.map(node => rule.violation(file_name.value, node.start + 1)));
		this.append_inheritance(violations);
	}

	/** Responsibilities: _aggregation assertion grouping complexity_. **/
	public append_assertions(): void {
		const { violations, file_name, classes, python_imports } = this.input;
		for (const node of classes) {
			for (const method of node.methods) {
				this.append_exception_bypass(violations, file_name.value, method);
			}
		}
		if (!python_imports.some(item => item.module === 'unittest')) {
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
