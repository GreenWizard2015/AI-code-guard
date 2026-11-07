import { ConstructorRules } from "src/parser/analysis/constructor_rules";
import { DeclarationPredicates } from "src/parser/analysis/declaration_predicates";
import { COMPLEX_DEFAULT, PARAMETER_PROPERTY, SINGULAR_PLURAL_ALIAS } from "src/parser/internals/constants";
import { TypeScriptAssignmentValuePredicates } from "src/parser/internals/type_script_assignment_value_predicates";
import { TypeScriptBooleanExpression } from "src/parser/internals/type_script_boolean_expression";
import { TypeScriptAliasPair } from "src/rules/typescript/syntax-rules/runtime/type_script_alias_pair";
import type { BooleanExpressionContract } from "src/runtime_protocols";
import type { CallableRuleAppender } from "src/types";
import type {
	TypeScriptAssignmentValuePredicatesContract,
	TypeScriptVariableDeclarationIndexContract,
} from "src/typescript_analysis_protocols";
import type { TypeScriptBasicRulesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _TypeScript parameter rules_, _alias rules_. **/
export class TypeScriptBasicRules implements TypeScriptBasicRulesContract {
	private readonly _boolean_expression: BooleanExpressionContract;
	private readonly _assignment_value_predicates: TypeScriptAssignmentValuePredicatesContract;
	private readonly _declaration_predicates: DeclarationPredicates;
	private readonly _alias_pair: TypeScriptAliasPair;

	/** Responsibilities: _complex parameter default rule_. **/
	private append_default_rule(parameter: ts.ParameterDeclaration, default_rule_appender: CallableRuleAppender): void {
		const initializer = parameter.initializer;
		if (initializer === undefined) {
			return;
		}
		if (this._assignment_value_predicates.primitive_expression(initializer)) {
			return;
		}
		if (this._assignment_value_predicates.enum_member_default(initializer)) {
			return;
		}
		default_rule_appender(parameter, COMPLEX_DEFAULT);
	}

	/** Responsibilities: _basic rule dependency initialization_. **/
	public constructor(variable_declaration_index: TypeScriptVariableDeclarationIndexContract) {
		this._declaration_predicates = new DeclarationPredicates(new ConstructorRules());
		this._alias_pair = new TypeScriptAliasPair(
			new Set([ts.SyntaxKind.PropertyDeclaration, ts.SyntaxKind.PropertySignature]),
		);
		this._boolean_expression = new TypeScriptBooleanExpression(variable_declaration_index);
		this._assignment_value_predicates = new TypeScriptAssignmentValuePredicates(
			this._boolean_expression,
			variable_declaration_index,
		);
	}

	/** Responsibilities: _parameter rule collection_. **/
	public append_parameter_rules(parameter_candidate: ts.Node, parameter_rule_appender: CallableRuleAppender): void {
		if (ts.isParameter(parameter_candidate)) {
			this.append_default_rule(parameter_candidate, parameter_rule_appender);
		}
		if (this._declaration_predicates.parameter_property(parameter_candidate)) {
			parameter_rule_appender(parameter_candidate, PARAMETER_PROPERTY);
		}
	}

	/** Responsibilities: _alias rule collection_. **/
	public append_alias_rules(alias_candidate: ts.Node, alias_rule_appender: CallableRuleAppender): void {
		if (this._alias_pair.alias_pair(alias_candidate)) {
			alias_rule_appender(alias_candidate, SINGULAR_PLURAL_ALIAS);
		}
	}
}
