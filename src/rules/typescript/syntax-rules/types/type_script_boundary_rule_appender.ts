import { TypeScriptBasicRules } from "src/rules/typescript/syntax-rules/runtime/type_script_basic_rules";
import { TypeScriptExpressionRules } from "src/rules/typescript/syntax-rules/expressions/type_script_expression_rules";
import type { CompositeStateTypeRulesContract, NullableTypeRulesContract } from "src/protocols";
import { UnionContractBypass } from "src/rules/typescript/syntax-rules/types/union_contract_bypass";
import {
	COMPOSITE_STATE_TYPE,
	EXCEPTION_RAISING,
	GETATTR,
	LARGE_UNION,
	NULLABLE_DOMAIN_TYPE,
	SETATTR,
	UNION_CONTRACT_BYPASS,
} from "src/parser/internals/constants";
import ts from "typescript";
import type { RuleContextData } from "src/types";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";
import type {
	TypeScriptBasicRulesContract,
	TypeScriptBoundaryRuleAppenderContract,
	TypeScriptExpressionRulesContract,
	TypeScriptVariableDeclarationIndexContract,
} from "src/protocols";
import { TestPathSyntax } from "src/test_path_syntax";

/** Responsibilities: _callable boundary diagnostics_, _type boundary diagnostics_. **/
export class TypeScriptBoundaryRuleAppender implements TypeScriptBoundaryRuleAppenderContract {
	private readonly max_union_types = 3;
	private readonly basic_rules: TypeScriptBasicRulesContract;
	private readonly expression_rules: TypeScriptExpressionRulesContract;
	private readonly getattr_aliases: TypeScriptExpressionAliases;
	private readonly setattr_aliases: TypeScriptExpressionAliases;
	private readonly nullable_type_rules: NullableTypeRulesContract;
	private readonly union_contract_bypass: UnionContractBypass;
	private readonly composite_state_type: CompositeStateTypeRulesContract;
	private readonly test_path_syntax: TestPathSyntax;

	/** Responsibilities: _aggregation callable boundary rules_. **/
	private append_call_rules(node: ts.Node, context: RuleContextData): void {
		if (ts.isCallExpression(node)) {
			if (!ts.isIdentifier(node.expression)) {
				return;
			}
			if (this.getattr_aliases.receiver(node.expression, node)) {
				context.append_rule(node, GETATTR);
			}
			if (this.setattr_aliases.receiver(node.expression, node)) {
				context.append_rule(node, SETATTR);
			}
		}
		if (ts.isUnionTypeNode(node)) {
			if (node.types.length > this.max_union_types) {
				context.append_rule(node, LARGE_UNION);
			}
		}
	}

	/** Responsibilities: _aggregation union nullable boundary_. **/
	private append_union_rules(node: ts.Node, context: RuleContextData): void {
		if (this.nullable_type_rules.nullable_type(node)) {
			context.append_rule(node, NULLABLE_DOMAIN_TYPE);
		}
		if (this.union_contract_bypass.bypass(node)) {
			context.append_rule(node, UNION_CONTRACT_BYPASS);
		}
		if (this.composite_state_type.violation(node)) {
			context.append_rule(node, COMPOSITE_STATE_TYPE);
		}
	}

	/** Responsibilities: _aggregation basic type boundary_. **/
	private append_basic_rules(node: ts.Node, context: RuleContextData): void {
		if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
			this.basic_rules.append_alias_rules(node, context.append_rule);
		}
		if (ts.isInterfaceDeclaration(node)) {
			this.basic_rules.append_alias_rules(node, context.append_rule);
		}
		if (ts.isParameter(node)) {
			this.basic_rules.append_parameter_rules(node, context.append_rule);
		}
		this.expression_rules.append(node, context.append_rule);
		if (this.test_path_syntax.test_file_name(context.file)) {
			if (ts.isThrowStatement(node)) {
				context.append_rule(node, EXCEPTION_RAISING);
			}
		}
	}

	/** Responsibilities: _aggregation inline composite union_. **/
	private append_union_types(node: ts.Node, context: RuleContextData): void {
		if (!this.union_rules_apply(node)) {
			return;
		}
		this.append_call_rules(node, context);
		if (ts.isParameter(node) || ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
			this.append_union_rules(node, context);
			return;
		}
		if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
			this.append_union_rules(node, context);
		}
	}

	/** Responsibilities: _aggregation boundary rules applicable_. **/
	/** Responsibilities: _basic type rule initialization_. **/
	public constructor(
		nullable_type_rules: NullableTypeRulesContract,
		composite_state_type: CompositeStateTypeRulesContract,
		variable_declaration_index: TypeScriptVariableDeclarationIndexContract,
	) {
		this.getattr_aliases = new TypeScriptExpressionAliases("getattr");
		this.setattr_aliases = new TypeScriptExpressionAliases("setattr");
		this.union_contract_bypass = new UnionContractBypass();
		this.basic_rules = new TypeScriptBasicRules(variable_declaration_index);
		this.expression_rules = new TypeScriptExpressionRules(variable_declaration_index);
		this.nullable_type_rules = nullable_type_rules;
		this.composite_state_type = composite_state_type;
		this.test_path_syntax = new TestPathSyntax();
	}

	/** Responsibilities: _boundary rule application_. **/
	public append(node: ts.Node, context: RuleContextData): void {
		this.append_basic_rules(node, context);
		this.append_union_types(node, context);
	}

	/** Responsibilities: _reporting union boundary rules_. **/
	public union_rules_apply(node: ts.Node): boolean {
		if (ts.isCallExpression(node) || ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
			return true;
		}
		return ts.isParameter(node) || ts.isPropertyDeclaration(node) || ts.isPropertySignature(node);
	}
}
