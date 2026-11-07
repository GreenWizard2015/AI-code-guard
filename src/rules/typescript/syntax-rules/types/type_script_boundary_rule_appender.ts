import {
	BASIC_ALIAS_NODE_KINDS,
	BOUNDARY_RULE_NODE_KINDS,
	COMPOSITE_STATE_TYPE,
	EXCEPTION_RAISING,
	EXPRESSION_RULE_FLAGS,
	EXPRESSION_RULE_FLAGS_BY_KIND,
	GETATTR,
	LARGE_UNION,
	NULLABLE_DOMAIN_TYPE,
	SETATTR,
	UNION_CONTRACT_BYPASS,
} from "src/parser/internals/constants";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptExpressionOperatorRules } from "src/rules/typescript/syntax-rules/expressions/operators/type_script_expression_operator_rules";
import { TypeScriptExpressionDeclarationRules } from "src/rules/typescript/syntax-rules/expressions/type_script_expression_declaration_rules";
import { TypeScriptExpressionTerminalRules } from "src/rules/typescript/syntax-rules/expressions/type_script_expression_terminal_rules";
import { TypeScriptBasicRules } from "src/rules/typescript/syntax-rules/runtime/type_script_basic_rules";
import { UnionTypeBypass } from "src/rules/typescript/syntax-rules/types/union_type_bypass";
import type { CompositeStateTypeRulesContract, NullableTypeRulesContract } from "src/runtime_protocols";
import { TestPathKind } from "src/types";
import type { CallableRuleAppender, RuleContextContract } from "src/types";
import type {
	TypeScriptBoundaryRuleAppenderContract,
	TypeScriptVariableDeclarationIndexContract,
} from "src/typescript_analysis_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptBasicRulesContract, TypeScriptExpressionRuleContract } from "src/typescript_runtime_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _callable boundary diagnostics_, _type boundary diagnostics_. **/
export class TypeScriptBoundaryRuleAppender implements TypeScriptBoundaryRuleAppenderContract {
	private readonly max_union_types = 3;
	private readonly _basic_rules: TypeScriptBasicRulesContract;
	private readonly _expression_declaration_rules: TypeScriptExpressionRuleContract;
	private readonly _expression_operator_rules: TypeScriptExpressionRuleContract;
	private readonly _expression_terminal_rules: TypeScriptExpressionRuleContract;
	private readonly _getattr_aliases: TypeScriptExpressionAliasesContract;
	private readonly _setattr_aliases: TypeScriptExpressionAliasesContract;
	private readonly _nullable_type_rules: NullableTypeRulesContract;
	private readonly _union_contract_bypass: UnionTypeBypass;
	private readonly _composite_state_type: CompositeStateTypeRulesContract;

	/** Responsibilities: _aggregation callable boundary rules_. **/
	private append_call_rules(call_candidate: ts.Node, call_context: RuleContextContract): void {
		if (ts.isCallExpression(call_candidate)) {
			if (!ts.isIdentifier(call_candidate.expression)) {
				return;
			}
			if (this._getattr_aliases.receiver({ expression: call_candidate.expression, node: call_candidate })) {
				call_context.for_node(call_candidate).append_rule(GETATTR);
			}
			if (this._setattr_aliases.receiver({ expression: call_candidate.expression, node: call_candidate })) {
				call_context.for_node(call_candidate).append_rule(SETATTR);
			}
		}
		if (ts.isUnionTypeNode(call_candidate) && call_candidate.types.length > this.max_union_types) {
			call_context.for_node(call_candidate).append_rule(LARGE_UNION);
		}
	}

	/** Responsibilities: _aggregation union nullable boundary_. **/
	private append_union_rules(union_candidate: ts.Node, union_context: RuleContextContract): void {
		if (this._nullable_type_rules.nullable_type(union_candidate)) {
			union_context.for_node(union_candidate).append_rule(NULLABLE_DOMAIN_TYPE);
		}
		if (this._union_contract_bypass.bypass(union_candidate)) {
			union_context.for_node(union_candidate).append_rule(UNION_CONTRACT_BYPASS);
		}
		if (this._composite_state_type.violation(union_candidate)) {
			union_context.for_node(union_candidate).append_rule(COMPOSITE_STATE_TYPE);
		}
	}

	/** Responsibilities: _aggregation inline composite union_. **/
	private append_union_types(type_candidate: ts.Node, type_context: RuleContextContract): void {
		const call_candidate = ts.isCallExpression(type_candidate) || ts.isUnionTypeNode(type_candidate);
		const composite_candidate =
			ts.isParameter(type_candidate) ||
			ts.isPropertyDeclaration(type_candidate) ||
			ts.isPropertySignature(type_candidate) ||
			ts.isUnionTypeNode(type_candidate) ||
			ts.isIntersectionTypeNode(type_candidate);
		if (!call_candidate && !composite_candidate) {
			return;
		}
		this.append_call_rules(type_candidate, type_context);
		if (composite_candidate) {
			this.append_union_rules(type_candidate, type_context);
		}
	}

	/** Responsibilities: _test exception reporting_. **/
	private append_test_exception(candidate: ts.Node, context: RuleContextContract): void {
		if (!context.state().source.path_kinds.has(TestPathKind.TestFileName)) {
			return;
		}
		if (ts.isThrowStatement(candidate)) {
			context.for_node(candidate).append_rule(EXCEPTION_RAISING);
		}
	}

	/** Responsibilities: _expression rule dispatch_. **/
	private append_expression_rules(candidate: ts.Node, append_rule: CallableRuleAppender): void {
		const expression_rule_flags = EXPRESSION_RULE_FLAGS_BY_KIND.get(candidate.kind);
		if (expression_rule_flags === undefined) {
			return;
		}
		if ((expression_rule_flags & EXPRESSION_RULE_FLAGS.declaration) !== 0) {
			this._expression_declaration_rules.append(candidate, append_rule);
		}
		if ((expression_rule_flags & EXPRESSION_RULE_FLAGS.operator) !== 0) {
			this._expression_operator_rules.append(candidate, append_rule);
		}
		if ((expression_rule_flags & EXPRESSION_RULE_FLAGS.terminal) !== 0) {
			this._expression_terminal_rules.append(candidate, append_rule);
		}
	}

	/** Responsibilities: _basic type rule initialization_. **/
	public constructor(
		nullable_type_rules: NullableTypeRulesContract,
		composite_state_type: CompositeStateTypeRulesContract,
		variable_declaration_index: TypeScriptVariableDeclarationIndexContract,
		declaration_index: TypeScriptObjectAliasDeclarationIndexContract,
	) {
		this._getattr_aliases = new TypeScriptExpressionAliases("getattr", declaration_index);
		this._setattr_aliases = new TypeScriptExpressionAliases("setattr", declaration_index);
		this._union_contract_bypass = new UnionTypeBypass(new Set([ts.SyntaxKind.UnionType]));
		this._basic_rules = new TypeScriptBasicRules(variable_declaration_index);
		this._expression_declaration_rules = new TypeScriptExpressionDeclarationRules();
		this._expression_operator_rules = new TypeScriptExpressionOperatorRules(declaration_index);
		this._expression_terminal_rules = new TypeScriptExpressionTerminalRules(
			variable_declaration_index,
			declaration_index,
		);
		this._nullable_type_rules = nullable_type_rules;
		this._composite_state_type = composite_state_type;
	}

	/** Responsibilities: _boundary rule application_. **/
	public append(boundary_candidate: ts.Node, boundary_context: RuleContextContract): void {
		if (!BOUNDARY_RULE_NODE_KINDS.has(boundary_candidate.kind)) {
			return;
		}
		const append_rule: CallableRuleAppender = (node, rule_id): void => {
			boundary_context.for_node(node).append_rule(rule_id);
		};
		if (BASIC_ALIAS_NODE_KINDS.has(boundary_candidate.kind)) {
			this._basic_rules.append_alias_rules(boundary_candidate, append_rule);
		}
		if (ts.isParameter(boundary_candidate)) {
			this._basic_rules.append_parameter_rules(boundary_candidate, append_rule);
		}
		this.append_expression_rules(boundary_candidate, append_rule);
		this.append_test_exception(boundary_candidate, boundary_context);
		this.append_union_types(boundary_candidate, boundary_context);
	}
}
