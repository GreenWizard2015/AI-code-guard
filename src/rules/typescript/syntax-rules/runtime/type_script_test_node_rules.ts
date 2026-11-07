import { RULE_IDS } from "src/linting/constants";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptStaticExpressionOperations } from "src/parser/typescript-aliases/type_script_static_expression_operations";
import { TypeScriptStaticExpressionValues } from "src/parser/typescript-aliases/type_script_static_expression_values";
import { ConsoleAliasIndex } from "src/rules/typescript/syntax-rules/runtime/console_alias_index";
import { ConsoleMock } from "src/rules/typescript/syntax-rules/runtime/console_mock";
import { RuntimePatching } from "src/rules/typescript/syntax-rules/runtime/runtime-patching/runtime_patching";
import type { StaticExpressionValuesContract } from "src/shared_services_protocols";
import type { RuleContextContract } from "src/types";
import type {
	TypeScriptExpressionAliasesContract,
	TypeScriptObjectAliasDeclarationIndexContract,
} from "src/typescript_runtime_protocols";
import type { TypeScriptTestNodeRulesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _Jest assertion checks_, _console mock policy checks_. **/
export class TypeScriptTestNodeRules implements TypeScriptTestNodeRulesContract {
	private readonly _console_mock: ConsoleMock;
	private readonly _console_alias_index: ConsoleAliasIndex;
	private readonly _static_expression_values: StaticExpressionValuesContract;
	private readonly _runtime_patching: RuntimePatching;
	private readonly _expect_aliases: TypeScriptExpressionAliasesContract;

	/** Responsibilities: _unwrapping expect callee_. **/
	private unwrapped_expression(expect_callee: ts.Expression): ts.Expression {
		let current = expect_callee;
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

	/** Responsibilities: _aggregation expectation diagnostics test_. **/
	private append_expect(call_candidate: ts.Node, assertion_context: RuleContextContract): void {
		if (!assertion_context.state().source.test_file) {
			return;
		}
		if (!ts.isCallExpression(call_candidate)) {
			return;
		}
		if (this.inside_test_callback(call_candidate)) {
			return;
		}
		const expect_callee = this.unwrapped_expression(call_candidate.expression);
		if (this._expect_aliases.receiver({ expression: expect_callee, node: call_candidate })) {
			assertion_context.for_node(call_candidate).append_rule(RULE_IDS.assertion_outside_test);
		}
	}

	/** Responsibilities: _classification node inside Jest_. **/
	private inside_test_callback(assertion_call: ts.Node): boolean {
		let current = assertion_call.parent;
		while (current !== undefined) {
			if (ts.isFunctionLike(current) && this.is_test_callback(current)) {
				return true;
			}
			current = current.parent;
		}
		return false;
	}

	/** Responsibilities: _classification node Jest callback_. **/
	private is_test_callback(callback_candidate: ts.Node): boolean {
		const parent = callback_candidate.parent;
		if (!ts.isCallExpression(parent)) {
			return false;
		}
		let expression = parent.expression;
		if (ts.isCallExpression(expression)) {
			expression = expression.expression;
		}
		if (!this.is_test_expression(expression)) {
			return false;
		}
		return parent.arguments.some((argument) => {
			const same_position = argument.pos === callback_candidate.pos && argument.end === callback_candidate.end;
			return same_position;
		});
	}

	/** Responsibilities: _classification expression Jest test_. **/
	private is_test_expression(test_callee: ts.Expression): boolean {
		if (ts.isIdentifier(test_callee)) {
			return test_callee.text === "test";
		}
		if (!ts.isPropertyAccessExpression(test_callee) || !ts.isIdentifier(test_callee.expression)) {
			return false;
		}
		if (test_callee.expression.text !== "test") {
			return false;
		}
		return test_callee.name.text === "each";
	}

	/** Responsibilities: _aggregation console-mock console-use diagnostics_. **/
	private append_console_rule(console_candidate: ts.Node, console_context: RuleContextContract): void {
		if (this._console_mock.console_mock(console_candidate)) {
			console_context.for_node(console_candidate).append_rule(RULE_IDS.typescript_console_mock_in_test);
			return;
		}
		if (this._console_mock.console_usage(console_candidate)) {
			console_context.for_node(console_candidate).append_rule(RULE_IDS.typescript_console_in_test);
		}
	}

	/** Responsibilities: _test runtime patch diagnostics_. **/
	private append_patch_rule(candidate: ts.Node, context: RuleContextContract): void {
		const state = context.state();
		let is_patch: boolean;
		if (state.source.test_file) {
			is_patch = this._runtime_patching.patch_test_node(
				candidate,
				state.analysis.module_resolver,
				state.analysis.source_resolver,
			);
		} else {
			is_patch = this._runtime_patching.patch_node(candidate);
		}
		if (is_patch) {
			context.for_node(candidate).append_rule(RULE_IDS.runtime_patching);
		}
	}

	/** Responsibilities: _reporting AST node Jest_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor(declaration_index: TypeScriptObjectAliasDeclarationIndexContract) {
		this._static_expression_values = new TypeScriptStaticExpressionValues(new TypeScriptStaticExpressionOperations());
		this._console_alias_index = new ConsoleAliasIndex(declaration_index, this._static_expression_values);
		this._console_mock = new ConsoleMock(this._console_alias_index, declaration_index);
		this._runtime_patching = new RuntimePatching(declaration_index);
		this._expect_aliases = new TypeScriptExpressionAliases("expect", declaration_index);
	}
	/** Responsibilities: _public operation_. **/
	public test_node(candidate_node: ts.Node): boolean {
		if (ts.isCallExpression(candidate_node)) {
			return true;
		}
		if (ts.isBinaryExpression(candidate_node)) {
			return true;
		}
		if (ts.isClassDeclaration(candidate_node)) {
			return true;
		}
		return ts.isClassExpression(candidate_node);
	}

	/** Responsibilities: _aggregation test-specific rules applicable_. **/
	public append_rules(test_candidate: ts.Node, rule_context: RuleContextContract): void {
		this.append_patch_rule(test_candidate, rule_context);
		this.append_expect(test_candidate, rule_context);
		if (rule_context.state().source.test_file) {
			this.append_console_rule(test_candidate, rule_context);
		}
	}
}
