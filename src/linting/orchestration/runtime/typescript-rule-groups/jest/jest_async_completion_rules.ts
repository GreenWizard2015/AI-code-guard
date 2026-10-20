import { JestAsyncResultObservation } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_async_result_observation";
import { JestBindingIndex } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_binding_index";
import { JestExecutionRegion } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_execution_region";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/reporting_protocols";
import type {
	JestAsyncCompletionRulesContract,
	JestBindingIndexContract,
	JestSuiteCollectorContract,
} from "src/testing_protocols";
import ts from "typescript";

/** Responsibilities: _async callback diagnostics_, _completion violation reporting_. **/
export class JestAsyncCompletionRules implements JestAsyncCompletionRulesContract {
	private readonly suite_collector: JestSuiteCollectorContract;
	private readonly rule: DiagnosticRule;

	/** Responsibilities: _async declaration invocations_. **/
	private async_call(node: ts.CallExpression, bindings: JestBindingIndexContract): boolean {
		if (!ts.isIdentifier(node.expression)) {
			return false;
		}
		return bindings.binding_is(node.expression, bindings.async_declarations);
	}

	/** Responsibilities: _unobserved variable result classification_. **/
	private unobserved_variable(
		node: ts.CallExpression,
		callback: ts.FunctionLikeDeclaration,
		bindings: JestBindingIndexContract,
	): boolean {
		if (!ts.isVariableDeclaration(node.parent)) {
			return false;
		}
		if (node.parent.initializer !== node) {
			return false;
		}
		const body = callback.body;
		if (body === undefined) {
			return false;
		}
		if (!ts.isBlock(body)) {
			return false;
		}
		const observation = new JestAsyncResultObservation(node.parent, body, callback, bindings);
		return !observation.completed();
	}

	/** Responsibilities: _discarded async result detection_. **/
	private discarded_call(
		node: ts.Node,
		callback: ts.FunctionLikeDeclaration,
		bindings: JestBindingIndexContract,
	): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		if (!this.async_call(node, bindings)) {
			return false;
		}
		if (ts.isExpressionStatement(node.parent) && node.parent.expression === node) {
			return true;
		}
		return this.unobserved_variable(node, callback, bindings);
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
			violations.push(this.rule.violation(file, line));
		});
		region.visit();
	}

	/** Responsibilities: _async completion rule initialization_. **/
	public constructor(suite_collector: JestSuiteCollectorContract) {
		this.suite_collector = suite_collector;
		this.rule = new DiagnosticRule("unasserted-async-completion");
	}

	/** Responsibilities: _async completion diagnostics_. **/
	public append(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void {
		const bindings = new JestBindingIndex(source_file);
		for (const test of tests) {
			this.suite_collector.with_callback(test, (callback) => {
				this.append_callback(violations, file, source_file, callback, bindings);
			});
		}
	}
}
