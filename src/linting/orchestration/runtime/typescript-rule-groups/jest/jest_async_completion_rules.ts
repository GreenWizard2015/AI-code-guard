import ts from "typescript";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { JestAsyncCompletionRulesContract, JestBindingIndexContract, JestSuiteCollectorContract, ViolationContract } from "src/protocols";
import { JestBindingIndex } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_binding_index";
import { JestExecutionRegion } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_execution_region";

/** Responsibilities: _async callback analysis_, _completion violation reporting_. **/
export class JestAsyncCompletionRules implements JestAsyncCompletionRulesContract {
	private readonly suite_collector: JestSuiteCollectorContract;
	private readonly rule: DiagnosticRule;

	/** Responsibilities: _asynchronous expression_. **/
	private async_expression(node: ts.Node, bindings: JestBindingIndexContract): boolean {
		if (!ts.isExpressionStatement(node)) {
			return false;
		}
		const expression = node.expression;
		if (!ts.isCallExpression(expression)) {
			return false;
		}
		if (!ts.isIdentifier(expression.expression)) {
			return false;
		}
		return bindings.async_binding(expression.expression);
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
			if (this.async_expression(node, bindings)) {
				const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1;
				violations.push(this.rule.violation(file, line));
			}
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
