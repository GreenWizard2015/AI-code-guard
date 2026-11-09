import type { ValueRulesContract } from "src/analysis_protocols";
import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { RULE_IDS } from "src/linting/constants";
import { ConstructorRules } from "src/parser/analysis/constructor_rules";
import { DeclarationPredicates } from "src/parser/analysis/declaration_predicates";
import { TypeScriptClassDeclarationRuleAnalyzer } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_class_declaration_rule_analyzer";
import { TypeScriptFieldWriteTargetIndex } from "src/rules/typescript/syntax-rules/ast/verifier/inherited-state/type_script_field_write_target_index";
import { RuntimeBuiltinPredicates } from "src/rules/typescript/syntax-rules/runtime/runtime_builtin_predicates";
import type { RuleContextContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _TypeScript declaration rules_, _class field rules_. **/
export class TypeScriptClassNodeRules implements ASTSourceRuleContract {
	private readonly _declaration_predicates: DeclarationPredicates;
	private readonly _prototype_predicates: RuntimeBuiltinPredicates;
	private readonly _field_write_targets: TypeScriptFieldWriteTargetIndex;
	private readonly _value_rules: ValueRulesContract;
	private readonly _rule_ids: typeof RULE_IDS;

	/** Responsibilities: _call-site rule ownership_. **/
	private append_call_rules(call_expression: ts.Node, call_context: RuleContextContract): void {
		const stage_timer = call_context.state().analysis.stage_timer;
		if (
			stage_timer.measure(`rule.${this._rule_ids.typescript_prototype_assignment}`, () =>
				this._prototype_predicates.prototype_assignment(call_expression),
			)
		) {
			call_context.for_node(call_expression).append_rule(this._rule_ids.typescript_prototype_assignment);
		}
		if (
			stage_timer.measure(`rule.${this._rule_ids.temporary_result_access}`, () =>
				this._declaration_predicates.temporary_result_access(call_expression),
			)
		) {
			call_context.for_node(call_expression).append_rule(this._rule_ids.temporary_result_access);
		}
		if (
			stage_timer.measure(`rule.${this._rule_ids.dynamic_type}`, () => this._value_rules.dynamic_class(call_expression))
		) {
			call_context.for_node(call_expression).append_rule(this._rule_ids.dynamic_type);
		}
	}

	/** Responsibilities: _prototype class rules_. **/
	private append_prototype_rules(prototype_candidate: ts.Node, prototype_context: RuleContextContract): void {
		prototype_context.state().analysis.stage_timer.measure("rule.object-field-write.typescript", () => {
			if (this._field_write_targets.field_write_violation(prototype_candidate)) {
				prototype_context.for_node(prototype_candidate).append_rule(this._rule_ids.object_field_write);
			}
		});
		if (
			prototype_context
				.state()
				.analysis.stage_timer.measure(`rule.${this._rule_ids.typescript_prototype_assignment}`, () =>
					this._prototype_predicates.prototype_assignment(prototype_candidate),
				)
		) {
			prototype_context.for_node(prototype_candidate).append_rule(this._rule_ids.typescript_prototype_assignment);
		}
	}

	/** Responsibilities: _declaration class rules_. **/
	private append_declaration_rules(declaration_node: ts.Node, declaration_context: RuleContextContract): void {
		const declaration_rules = new TypeScriptClassDeclarationRuleAnalyzer(
			declaration_node,
			declaration_context,
			this._declaration_predicates,
			this._prototype_predicates,
		);
		const rule_ids = [
			...declaration_rules.shape_rule_ids(),
			...declaration_rules.state_rule_ids(),
			...declaration_rules.field_rule_ids(),
		];
		if (
			declaration_context
				.state()
				.analysis.stage_timer.measure(`rule.${this._rule_ids.dynamic_type}`, () =>
					this._value_rules.dynamic_class(declaration_node),
				)
		) {
			rule_ids.push(this._rule_ids.dynamic_type);
		}
		for (const rule_id of rule_ids) {
			declaration_context.for_node(declaration_node).append_rule(rule_id);
		}
	}

	/** Responsibilities: _class rule dependency initialization_. **/
	public constructor(
		value_rules: ValueRulesContract,
		declaration_index: TypeScriptObjectAliasDeclarationIndexContract,
	) {
		this._rule_ids = RULE_IDS;
		const declaration_predicates = new DeclarationPredicates(new ConstructorRules());
		const prototype_predicates = new RuntimeBuiltinPredicates(declaration_index);
		this._declaration_predicates = declaration_predicates;
		this._prototype_predicates = prototype_predicates;
		this._field_write_targets = new TypeScriptFieldWriteTargetIndex();
		this._value_rules = value_rules;
	}

	/** Responsibilities: _class node rules_. **/
	public append(node: ts.Node, context: RuleContextContract): void {
		switch (node.kind) {
			case ts.SyntaxKind.CallExpression: {
				this.append_call_rules(node, context);
				return;
			}
			case ts.SyntaxKind.BinaryExpression:
			case ts.SyntaxKind.PrefixUnaryExpression:
			case ts.SyntaxKind.PostfixUnaryExpression:
			case ts.SyntaxKind.ForInStatement:
			case ts.SyntaxKind.ForOfStatement: {
				this.append_prototype_rules(node, context);
				return;
			}
			default:
				break;
		}
		this.append_declaration_rules(node, context);
	}

	/** Responsibilities: _class verifier source activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _class verifier dispatch_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		this.append(request.node, request.context);
	}
}
