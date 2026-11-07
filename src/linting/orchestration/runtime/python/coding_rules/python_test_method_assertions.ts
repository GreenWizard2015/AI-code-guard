import { MAX_TEST_ASSERTIONS } from "src/constants";
import type { PythonRuleInput } from "src/linting/types";
import type { AstCallableDeclaration, AstCallableIdentity, AstCallableNode } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract } from "src/reporting_protocols";

/** Responsibilities: _test method assertion rules_, _exception assertion checks_. **/
export class PythonTestMethodAssertions {
	private readonly _input: PythonRuleInput;
	private readonly _method: AstCallableNode;
	private readonly _identity: AstCallableIdentity;
	private readonly _declaration: AstCallableDeclaration;
	private readonly _assertion_rule: RuleContract;
	private readonly _assertion_alias_rule: RuleContract;
	private readonly _ending_rule: RuleContract;
	private readonly _grouping_rule: RuleContract;
	private readonly _complexity_rule: RuleContract;
	private readonly _exception_only_rule: RuleContract;

	/** Responsibilities: _test method classification_. **/
	private test_method(): boolean {
		if (!this._identity.name.startsWith("test_")) {
			return false;
		}
		return !this._declaration.decorators.includes("fixture");
	}

	/** Responsibilities: _unittest ending state_. **/
	private unittest_ending_invalid(): boolean {
		if (this._method.test_behavior.has_unittest_assertion !== true) {
			return false;
		}
		return this._method.test_behavior.unittest_ending_valid !== true;
	}

	/** Responsibilities: _assertion presence diagnostics_. **/
	private append_assertion_presence(): void {
		const file = this._input.file_name.value();
		const line = this._method.identity.start + 1;
		if (this._method.test_behavior.has_unittest_assertion !== true) {
			this._input.violations.push(this._assertion_rule.violation(file, line, {}));
		}
		if (this.unittest_ending_invalid()) {
			this._input.violations.push(this._ending_rule.violation(file, line, {}));
		}
	}

	/** Responsibilities: _assertion count diagnostics_. **/
	private append_assertion_count(): void {
		const file = this._input.file_name.value();
		const line = this._method.identity.start + 1;
		if (this._method.test_behavior.unittest_assertion_count >= 3) {
			this._input.violations.push(this._grouping_rule.violation(file, line, {}));
		}
		if (this._method.test_behavior.unittest_assertion_count > MAX_TEST_ASSERTIONS) {
			this._input.violations.push(this._complexity_rule.violation(file, line, {}));
		}
	}

	/** Responsibilities: _test method assertion initialization_. **/
	public constructor(input: PythonRuleInput, method: AstCallableNode) {
		this._input = input;
		this._method = method;
		this._identity = method.identity;
		this._declaration = method.declaration;
		this._assertion_rule = new DiagnosticRule("python-test-assert");
		this._assertion_alias_rule = new DiagnosticRule("python-test-assertion-alias");
		this._ending_rule = new DiagnosticRule("python-test-assert-ending");
		this._grouping_rule = new DiagnosticRule("test-assertion-grouping");
		this._complexity_rule = new DiagnosticRule("test-too-many-assertions");
		this._exception_only_rule = new DiagnosticRule("test-exception-only");
	}

	/** Responsibilities: _exception bypass diagnostics_. **/
	public append_exception_bypass(): void {
		if (!this.test_method()) {
			return;
		}
		if (this._method.test_behavior.test_exception_bypass === true) {
			this._input.violations.push(
				this._exception_only_rule.violation(this._input.file_name.value(), this._method.identity.start + 1, {}),
			);
		}
	}

	/** Responsibilities: _unittest assertion diagnostics_. **/
	public append_unittest_assertions(): void {
		if (!this.test_method()) {
			return;
		}
		this.append_assertion_presence();
		if (this._method.test_behavior.unittest_exception_only === true) {
			this._input.violations.push(
				this._exception_only_rule.violation(this._input.file_name.value(), this._method.identity.start + 1, {}),
			);
		}
		if (this._method.test_behavior.unittest_assertion_alias === true) {
			this._input.violations.push(
				this._assertion_alias_rule.violation(this._input.file_name.value(), this._method.identity.start + 1, {}),
			);
		}
		this.append_assertion_count();
	}
}
