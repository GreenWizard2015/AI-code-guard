import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { RULE_IDS } from "src/linting/constants";
import { TypeScriptConditionalRules } from "src/rules/typescript/syntax-rules/expressions/type_script_conditional_rules";
import { TypeScriptOperatorPrecedence } from "src/rules/typescript/syntax-rules/expressions/type_script_operator_precedence";
import { CompositeStateTypeRules } from "src/rules/typescript/syntax-rules/types/composite_state_type_rules";
import { NullableTypeRules } from "src/rules/typescript/syntax-rules/types/nullable_type_rules";
import { RestUnionRule } from "src/rules/typescript/syntax-rules/types/rest_union/rest_union_rule";
import { TypeScriptStructuralRules } from "src/rules/typescript/syntax-rules/types/structural/type_script_structural_rules";
import { TypeScriptBoundaryRuleAppender } from "src/rules/typescript/syntax-rules/types/type_script_boundary_rule_appender";
import { TypeScriptTypeShapeRules } from "src/rules/typescript/syntax-rules/types/type_script_type_shape_rules";
import type { CallableRuleAppender, RuleContextContract, RuleNodeDiagnosticContextContract } from "src/types";
import type { TypeScriptVariableDeclarationIndexContract } from "src/typescript_analysis_protocols";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _type syntax rules_, _conditional rule dispatch_, _type boundary rules_. **/
export class TypeScriptTypeRules implements ASTSourceRuleContract {
	private readonly _expression_structure: TypeScriptStructuralRules;
	private readonly _conditional_rules: TypeScriptConditionalRules;
	private readonly _type_shape_rules: TypeScriptTypeShapeRules;
	private readonly _boundary_rules: TypeScriptBoundaryRuleAppender;
	private readonly _rest_union_rule: RestUnionRule;

	/** Responsibilities: _bare alias rules_. **/
	private append_alias(
		type_alias: ts.TypeAliasDeclaration,
		diagnostic_context: RuleNodeDiagnosticContextContract,
	): void {
		if (this.bare_alias(type_alias)) {
			diagnostic_context.append_rule(RULE_IDS.typescript_bare_type_alias);
		}
	}

	/** Responsibilities: _access conditional rules_. **/
	private append_access_conditionals(node: ts.Node, context: RuleContextContract): boolean {
		if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) {
			return false;
		}
		const source_file = context.state().source.source_file;
		const append_rule: CallableRuleAppender = (candidate, rule_id): void => {
			context.for_node(candidate).append_rule(rule_id);
		};
		this._conditional_rules.append(node, source_file, append_rule);
		return true;
	}

	/** Responsibilities: _type boundary rules_. **/
	private append_boundary(node: ts.Node, context: RuleContextContract): void {
		this._boundary_rules.append(node, context);
		if (ts.isParameter(node)) {
			this._rest_union_rule.append_rule(node, context);
		}
	}

	/** Responsibilities: _bare alias structure_. **/
	private bare_alias(statement: ts.TypeAliasDeclaration): boolean {
		if (!ts.isTypeReferenceNode(statement.type) || statement.type.typeArguments !== undefined) {
			return false;
		}
		const type_name = statement.type.typeName;
		if (!ts.isIdentifier(type_name) && !ts.isQualifiedName(type_name)) {
			return false;
		}
		if (!ts.isIdentifier(type_name)) {
			return true;
		}
		return !statement.typeParameters?.some((parameter) => parameter.name.text === type_name.text);
	}

	/** Responsibilities: _type rule dependencies_. **/
	public constructor(
		variable_declaration_index: TypeScriptVariableDeclarationIndexContract,
		declaration_index: TypeScriptObjectAliasDeclarationIndexContract,
	) {
		this._expression_structure = new TypeScriptStructuralRules(new TypeScriptOperatorPrecedence());
		this._conditional_rules = new TypeScriptConditionalRules(variable_declaration_index);
		this._type_shape_rules = new TypeScriptTypeShapeRules();
		const nullable_type_rules = new NullableTypeRules(
			new Set([
				ts.SyntaxKind.NullKeyword,
				ts.SyntaxKind.UndefinedKeyword,
				ts.SyntaxKind.VoidKeyword,
				ts.SyntaxKind.NeverKeyword,
				ts.SyntaxKind.UnknownKeyword,
				ts.SyntaxKind.AnyKeyword,
			]),
		);
		this._boundary_rules = new TypeScriptBoundaryRuleAppender(
			nullable_type_rules,
			new CompositeStateTypeRules(nullable_type_rules),
			variable_declaration_index,
			declaration_index,
		);
		this._rest_union_rule = new RestUnionRule();
	}

	/** Responsibilities: _type syntax rules_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		const { node, context } = request;
		if (ts.isTypeAliasDeclaration(node)) {
			this.append_alias(node, context.for_node(node));
		}
		if (this.append_access_conditionals(node, context)) {
			return;
		}
		this.append_boundary(node, context);
		this._expression_structure.append(node, context);
		const append_rule: CallableRuleAppender = (candidate, rule_id): void => {
			context.for_node(candidate).append_rule(rule_id);
		};
		if (ts.isBinaryExpression(node) || ts.isConditionalExpression(node) || ts.isCallExpression(node)) {
			const state = context.state();
			this._conditional_rules.append(node, state.source.source_file, append_rule);
		}
		this._type_shape_rules.append_type_rules(node, context);
	}

	/** Responsibilities: _source eligibility_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}
}
