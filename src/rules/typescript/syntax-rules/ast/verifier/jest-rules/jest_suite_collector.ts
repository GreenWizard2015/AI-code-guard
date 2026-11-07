import { JEST_DESCRIBE_NAME } from "src/constants";
import type { JestSuite } from "src/model/ast/normalized_ast_types";
import { TypeScriptStaticExpressionOperations } from "src/parser/typescript-aliases/type_script_static_expression_operations";
import { TypeScriptStaticExpressionValues } from "src/parser/typescript-aliases/type_script_static_expression_values";
import type { CallableConsumer } from "src/runtime_types";
import type { StaticExpressionValuesContract } from "src/shared_services_protocols";
import type { JestSuiteCollectorContract, JestTestCallbackTraversal } from "src/testing_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _Jest suite discovery_, _Jest suite alias resolution_. **/
export class JestSuiteCollector implements JestSuiteCollectorContract {
	private readonly _test_names: Set<string>;
	private readonly _modifier_names: Set<string>;
	private readonly _describe_name: string;
	private readonly _describe_aliases: TypeScriptExpressionAliasesContract;
	private readonly _test_aliases: TypeScriptExpressionAliasesContract;
	private readonly _it_aliases: TypeScriptExpressionAliasesContract;
	private readonly _static_expression_values: StaticExpressionValuesContract;

	/** Responsibilities: _unwrapping Jest invocation expression_. **/
	private unwrapped_expression(expression: ts.Expression): ts.Expression {
		let current = expression;
		while (true) {
			if (ts.isParenthesizedExpression(current)) {
				current = current.expression;
				continue;
			}
			if (ts.isAsExpression(current) || ts.isTypeAssertionExpression(current)) {
				current = current.expression;
				continue;
			}
			return current;
		}
	}

	/** Responsibilities: _Jest identifier names_. **/
	private identifier_call_name(call_identifier: ts.Identifier, identifier_context: ts.Node): string {
		if (this._describe_aliases.receiver({ expression: call_identifier, node: identifier_context })) {
			return this._describe_name;
		}
		if (this._test_aliases.receiver({ expression: call_identifier, node: identifier_context })) {
			return "test";
		}
		if (this._it_aliases.receiver({ expression: call_identifier, node: identifier_context })) {
			return "it";
		}
		return call_identifier.text;
	}

	/** Responsibilities: _Jest computed modifier names_. **/
	private element_call_name(modifier_access: ts.ElementAccessExpression, element_context: ts.Node): string {
		const argument = modifier_access.argumentExpression;
		if (argument === undefined) {
			return "";
		}
		const modifier = this._static_expression_values.value(argument, element_context);
		return this.modifier_call_name(modifier_access.expression, modifier, element_context);
	}

	/** Responsibilities: _Jest modifier invocation_. **/
	private modifier_call_name(modified_expression: ts.Expression, modifier: string, modifier_context: ts.Node): string {
		if (!this._modifier_names.has(modifier)) {
			return "";
		}
		return this.call_name(this.unwrapped_expression(modified_expression), modifier_context);
	}

	/** Responsibilities: _resolution Jest invocation expression_. **/
	private call_name(candidate_expression: ts.Expression, invocation_context: ts.Node): string {
		const current = this.unwrapped_expression(candidate_expression);
		if (ts.isCallExpression(current)) {
			return this.call_name(current.expression, invocation_context);
		}
		if (ts.isIdentifier(current)) {
			return this.identifier_call_name(current, invocation_context);
		}
		if (ts.isPropertyAccessExpression(current)) {
			return this.modifier_call_name(current.expression, current.name.text, invocation_context);
		}
		if (ts.isElementAccessExpression(current)) {
			return this.element_call_name(current, invocation_context);
		}
		return "";
	}

	/** Responsibilities: _classification invocation usage Jest_. **/
	private is_each_factory(candidate_call: ts.CallExpression): boolean {
		const expression = this.unwrapped_expression(candidate_call.expression);
		if (!ts.isPropertyAccessExpression(expression)) {
			return false;
		}
		return expression.name.text === "each";
	}

	/** Responsibilities: _classification invocation represents Jest_. **/
	private is_test_call(test_candidate: ts.CallExpression, call_name: string): boolean {
		if (this.is_each_factory(test_candidate)) {
			return false;
		}
		if (call_name.length > 0 && this._test_names.has(call_name)) {
			return true;
		}
		if (!ts.isCallExpression(test_candidate.expression)) {
			return false;
		}
		return this.is_each_factory(test_candidate.expression);
	}

	/** Responsibilities: _suite callback traversal_. **/
	private register_suite(node: ts.CallExpression, active_suites: JestSuite[], suites: JestSuite[]): void {
		const suite: JestSuite = { node, body: [], tests: [], nested: active_suites.length > 0 };
		suites.push(suite);
		active_suites.push(suite);
		this.with_callback(node, (callback) => {
			if (callback.body !== undefined) {
				if (ts.isBlock(callback.body)) {
					suite.body.push(callback.body);
				}
				ts.forEachChild(callback.body, (child) => this.visit_suite_nodes(child, active_suites, suites, 0));
			}
		});
		active_suites.pop();
	}

	/** Responsibilities: _test callback traversal_. **/
	private visit_test_call(node: ts.CallExpression, traversal: JestTestCallbackTraversal): void {
		if (traversal.callback_depth === 0) {
			const suite = traversal.active_suites.at(-1);
			if (suite !== undefined) {
				suite.tests.push(node);
			}
		}
		ts.forEachChild(node, (child) =>
			this.visit_suite_nodes(child, traversal.active_suites, traversal.suites, traversal.callback_depth + 1),
		);
	}

	/** Responsibilities: _suite and test discovery_. **/
	private visit_suite_nodes(
		node: ts.Node,
		active_suites: JestSuite[],
		suites: JestSuite[],
		test_callback_depth: number,
	): void {
		if (ts.isCallExpression(node)) {
			const call_name = this.call_name(node.expression, node);
			if (call_name === this._describe_name) {
				this.register_suite(node, active_suites, suites);
				return;
			}
			if (this.is_test_call(node, call_name)) {
				this.visit_test_call(node, { active_suites, suites, callback_depth: test_callback_depth });
				return;
			}
		}
		ts.forEachChild(node, (child) => this.visit_suite_nodes(child, active_suites, suites, test_callback_depth));
	}

	/** Responsibilities: _execution callback each discovered_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor(
		describe_aliases: TypeScriptExpressionAliasesContract,
		test_aliases: TypeScriptExpressionAliasesContract,
		it_aliases: TypeScriptExpressionAliasesContract,
	) {
		this._describe_name = JEST_DESCRIBE_NAME;
		this._test_names = new Set(["test", "it"]);
		this._modifier_names = new Set(["only", "skip", "concurrent", "fails", "todo", "each"]);
		this._describe_aliases = describe_aliases;
		this._test_aliases = test_aliases;
		this._it_aliases = it_aliases;
		this._static_expression_values = new TypeScriptStaticExpressionValues(new TypeScriptStaticExpressionOperations());
	}

	/** Responsibilities: _public operation_. **/
	public with_callback(callback_call: ts.CallExpression, consumer: CallableConsumer): void {
		const candidate = callback_call.arguments.at(-1);
		if (candidate === undefined) {
			return;
		}
		if (ts.isArrowFunction(candidate) || ts.isFunctionExpression(candidate)) {
			consumer(candidate);
		}
	}

	/** Responsibilities: _collection top-level Jest suites_. **/
	public suites(source_file: ts.SourceFile): JestSuite[] {
		const suites: JestSuite[] = [];
		const active_suites: JestSuite[] = [];
		ts.forEachChild(source_file, (child) => this.visit_suite_nodes(child, active_suites, suites, 0));
		return suites;
	}
}
