import { MAX_CALLABLE_CHARACTERS } from "src/constants";
import { RULE_IDS } from "src/linting/constants";
import { EARLY_RETURN, POINTLESS_BOOLEAN_OPERATION, TS_BLOCK } from "src/parser/internals/constants";
import { TypeScriptArithmeticPrecedence } from "src/rules/typescript/syntax-rules/expressions/type_script_arithmetic_precedence";
import { TypeScriptBooleanIdentityAnalysis } from "src/rules/typescript/syntax-rules/expressions/type_script_boolean_identity_analysis";
import { TypeScriptLogicalChain } from "src/rules/typescript/syntax-rules/expressions/type_script_logical_chain";
import { TypeScriptTerminalBranches } from "src/rules/typescript/syntax-rules/expressions/type_script_terminal_branches";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { RuleContextContract } from "src/types";
import type { TypeScriptOperatorPrecedenceContract } from "src/typescript_analysis_protocols";
import type { TypeScriptStructuralRulesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _expression structure rules_, _operator precedence rules_. **/
export class TypeScriptStructuralRules implements TypeScriptStructuralRulesContract {
	private readonly _logical_chain: TypeScriptLogicalChain;
	private readonly _operator_precedence: TypeScriptOperatorPrecedenceContract;
	private readonly _arithmetic_precedence: TypeScriptArithmeticPrecedence;
	private readonly _boolean_identity: TypeScriptBooleanIdentityAnalysis;
	private readonly _terminal_branches: TypeScriptTerminalBranches;

	/** Responsibilities: _boolean branch rules_. **/
	/** Responsibilities: _block statement rules_. **/
	private block_rule_targets(
		then_statement: ts.Statement,
		alternative_statements: readonly ts.Statement[],
	): readonly { readonly node: ts.Node; readonly rule_id: string }[] {
		const targets: { readonly node: ts.Node; readonly rule_id: string }[] = [];
		if (!ts.isBlock(then_statement)) {
			targets.push({ node: then_statement, rule_id: TS_BLOCK });
		}
		for (const alternative of alternative_statements) {
			if (ts.isIfStatement(alternative)) {
				continue;
			}
			if (!ts.isBlock(alternative)) {
				targets.push({ node: alternative, rule_id: TS_BLOCK });
			}
		}
		return targets;
	}

	/** Responsibilities: _conditional branch rules_. **/
	private if_rule_targets(
		branch: ts.IfStatement,
		timer: LintStageTimerContract,
	): readonly { readonly node: ts.Node; readonly rule_id: string }[] {
		const targets: { readonly node: ts.Node; readonly rule_id: string }[] = [];
		const alternatives: ts.Statement[] = [];
		if (branch.elseStatement !== undefined) {
			alternatives.push(branch.elseStatement);
		}
		const block_targets = timer.measure(`rule.${TS_BLOCK}`, () =>
			this.block_rule_targets(branch.thenStatement, alternatives),
		);
		targets.push(...block_targets);
		if (timer.measure(`rule.${EARLY_RETURN}`, () => this._terminal_branches.early_exit(branch))) {
			targets.push({ node: branch, rule_id: EARLY_RETURN });
		}
		return targets;
	}

	/** Responsibilities: _binary structure rule publication_. **/
	private binary_rule_targets(
		candidate: ts.BinaryExpression,
		timer: LintStageTimerContract,
	): readonly { readonly node: ts.Node; readonly rule_id: string }[] {
		const targets: { readonly node: ts.Node; readonly rule_id: string }[] = [];
		if (timer.measure(`rule.${RULE_IDS.logical_chain_size}`, () => this._logical_chain.long_chain(candidate))) {
			targets.push({ node: candidate, rule_id: RULE_IDS.logical_chain_size });
		}
		if (
			timer.measure(`rule.${RULE_IDS.mixed_boolean_precedence}`, () =>
				this._operator_precedence.mixed_boolean_operator(candidate),
			)
		) {
			targets.push({ node: candidate, rule_id: RULE_IDS.mixed_boolean_precedence });
		}
		if (
			timer.measure(`rule.${RULE_IDS.mixed_arithmetic_precedence}`, () =>
				this._arithmetic_precedence.mixed_operator(candidate),
			)
		) {
			targets.push({ node: candidate, rule_id: RULE_IDS.mixed_arithmetic_precedence });
		}
		return targets;
	}

	/** Responsibilities: _conditional structure rule publication_. **/
	private append_if_rules(branch: ts.IfStatement, context: RuleContextContract): void {
		const timer = context.state().analysis.stage_timer;
		if (timer.measure(`rule.${POINTLESS_BOOLEAN_OPERATION}`, () => this._boolean_identity.identity_return(branch))) {
			context.for_node(branch).append_rule(POINTLESS_BOOLEAN_OPERATION);
		}
		if (timer.measure(`rule.${RULE_IDS.branch_duplication}`, () => this._boolean_identity.repeated_branch(branch))) {
			context.for_node(branch).append_rule(RULE_IDS.branch_duplication);
		}
		for (const target of this.if_rule_targets(branch, timer)) {
			context.for_node(target.node).append_rule(target.rule_id);
		}
	}

	/** Responsibilities: _structural rule dependencies_. **/
	public constructor(operator_precedence: TypeScriptOperatorPrecedenceContract) {
		this._logical_chain = new TypeScriptLogicalChain(MAX_CALLABLE_CHARACTERS);
		this._arithmetic_precedence = new TypeScriptArithmeticPrecedence(
			new Set([
				ts.SyntaxKind.PlusToken,
				ts.SyntaxKind.MinusToken,
				ts.SyntaxKind.AsteriskToken,
				ts.SyntaxKind.SlashToken,
				ts.SyntaxKind.PercentToken,
				ts.SyntaxKind.AsteriskAsteriskToken,
			]),
		);
		this._operator_precedence = operator_precedence;
		this._boolean_identity = new TypeScriptBooleanIdentityAnalysis();
		this._terminal_branches = new TypeScriptTerminalBranches(new Set([ts.SyntaxKind.ReturnStatement]));
	}

	/** Responsibilities: _structural syntax rules_. **/
	public append(candidate: ts.Node, context: RuleContextContract): void {
		const timer = context.state().analysis.stage_timer;
		if (ts.isBinaryExpression(candidate)) {
			for (const target of this.binary_rule_targets(candidate, timer)) {
				context.for_node(target.node).append_rule(target.rule_id);
			}
		}
		if (ts.isIfStatement(candidate)) {
			this.append_if_rules(candidate, context);
		}
	}
}
