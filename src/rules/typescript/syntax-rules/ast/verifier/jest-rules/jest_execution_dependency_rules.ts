import { JEST_SHARED_MUTATION_METHODS } from "src/constants";
import { JestExecutionRegion } from "src/jest_execution_region";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { JestModuleState } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_module_state";
import type { JestBindingIndexContract, JestSuiteCollectorContract } from "src/testing_protocols";
import ts from "typescript";

/** Responsibilities: _test time dependencies_, _test execution order dependencies_. **/
export class JestExecutionDependencyRules {
	private readonly _file: string;
	private readonly _source_file: ts.SourceFile;
	private readonly _suite_collector: JestSuiteCollectorContract;
	private readonly _suite_tests: readonly ts.CallExpression[];
	private readonly _time_dependency_rule: RuleContract;
	private readonly _order_dependency_rule: RuleContract;
	private readonly _module_state: JestModuleState;

	/** Responsibilities: _uncontrolled time identification_. **/
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

	/** Responsibilities: _test state mutation collection_. **/
	private append_test_mutations(mutations: Map<string, number>, test: ts.CallExpression): void {
		this._suite_collector.with_callback(test, (callback) => {
			if (callback.body === undefined) {
				return;
			}
			for (const name of this._module_state.mutations(callback.body)) {
				const current_count = mutations.get(name);
				if (current_count === undefined) {
					mutations.set(name, 1);
					continue;
				}
				mutations.set(name, current_count + 1);
			}
		});
	}

	/** Responsibilities: _test execution dependency setup_. **/
	public constructor(
		file: string,
		source_file: ts.SourceFile,
		suite_collector: JestSuiteCollectorContract,
		suite_tests: readonly ts.CallExpression[],
		bindings: JestBindingIndexContract,
	) {
		this._file = file;
		this._source_file = source_file;
		this._suite_collector = suite_collector;
		this._suite_tests = suite_tests;
		this._time_dependency_rule = new DiagnosticRule("test-time-dependency");
		this._order_dependency_rule = new DiagnosticRule("test-order-dependency");
		this._module_state = new JestModuleState(JEST_SHARED_MUTATION_METHODS, bindings);
	}

	/** Responsibilities: _test time dependency diagnostics_. **/
	public time_dependency_violations(): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const test of this._suite_tests) {
			this._suite_collector.with_callback(test, (callback) => {
				if (callback.body === undefined) {
					return;
				}
				const region = new JestExecutionRegion(callback.body, (node) => {
					if (this.uncontrolled_time(node)) {
						const line = this._source_file.getLineAndCharacterOfPosition(node.getStart(this._source_file)).line + 1;
						violations.push(this._time_dependency_rule.violation(this._file, line, {}));
					}
				});
				region.visit();
			});
		}
		return violations;
	}

	/** Responsibilities: _test order dependency analysis_. **/
	public order_dependency_violations(): ViolationContract[] {
		this._module_state.declarations(this._source_file);
		const mutations = new Map<string, number>();
		for (const test of this._suite_tests) {
			this.append_test_mutations(mutations, test);
		}
		const violations: ViolationContract[] = [];
		for (const [name, count] of mutations) {
			if (count > 1) {
				violations.push(this._order_dependency_rule.violation(this._file, 1, { name }));
			}
		}
		return violations;
	}
}
