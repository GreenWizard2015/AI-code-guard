import { JestExecutionRegion } from "src/jest_execution_region";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { JestAsyncResultObservation } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_async_result_observation";
import type {
	JestAsyncCompletionRulesContract,
	JestBindingIndexContract,
	JestSuiteCollectorContract,
} from "src/testing_protocols";
import ts from "typescript";

/** Responsibilities: _async callback diagnostics_, _completion violation reporting_. **/
export class JestAsyncCompletionRules implements JestAsyncCompletionRulesContract {
	private readonly _suite_collector: JestSuiteCollectorContract;
	private readonly _bindings: JestBindingIndexContract;
	private readonly _rule: RuleContract;

	/** Responsibilities: _discarded async result detection_. **/
	private discarded_call(
		node: ts.Node,
		callback: ts.FunctionLikeDeclaration,
		bindings: JestBindingIndexContract,
	): boolean {
		if (!ts.isCallExpression(node) || !bindings.async_call(node)) {
			return false;
		}
		if (ts.isExpressionStatement(node.parent) && node.parent.expression === node) {
			return true;
		}
		if (!ts.isVariableDeclaration(node.parent) || node.parent.initializer !== node) {
			return false;
		}
		if (callback.body === undefined || !ts.isBlock(callback.body)) {
			return false;
		}
		const observation = new JestAsyncResultObservation(node.parent, callback.body, callback, bindings);
		return !observation.completed();
	}

	/** Responsibilities: _async callback diagnostics_. **/
	private append_callback(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		callback: ts.FunctionLikeDeclaration,
		bindings: JestBindingIndexContract,
	): void {
		if (callback.body === undefined) {
			return;
		}
		const region = new JestExecutionRegion(callback.body, (node) => {
			if (!this.discarded_call(node, callback, bindings)) {
				return;
			}
			const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1;
			violations.push(this._rule.violation(file, line, {}));
		});
		region.visit();
	}

	/** Responsibilities: _async completion rule initialization_. **/
	public constructor(suite_collector: JestSuiteCollectorContract, bindings: JestBindingIndexContract) {
		this._suite_collector = suite_collector;
		this._bindings = bindings;
		this._rule = new DiagnosticRule("unasserted-async-completion");
	}

	/** Responsibilities: _async completion diagnostics_. **/
	public append(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void {
		for (const test of tests) {
			this._suite_collector.with_callback(test, (callback) => {
				this.append_callback(violations, file, source_file, callback, this._bindings);
			});
		}
	}
}
