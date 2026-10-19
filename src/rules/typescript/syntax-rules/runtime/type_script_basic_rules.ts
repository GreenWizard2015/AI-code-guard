import { COMPLEX_DEFAULT, PARAMETER_PROPERTY, SINGULAR_PLURAL_ALIAS } from "src/parser/internals/constants";
import { TypeScriptAliasPair } from "src/rules/typescript/syntax-rules/runtime/type_script_alias_pair";
import { TypeScriptAssignmentValuePredicates } from "src/parser/internals/type_script_assignment_value_predicates";
import { TypeScriptBooleanExpression } from "src/parser/internals/type_script_boolean_expression";
import { DeclarationPredicates } from "src/parser/analysis/declaration_predicates";
import type {
	BooleanExpressionContract,
	TypeScriptAssignmentValuePredicatesContract,
	TypeScriptVariableDeclarationIndexContract,
} from "src/protocols";
import type { RuleAppender } from "src/types";
import ts from "typescript";

/** Responsibilities: _TypeScript parameter rules_, _alias rules_. **/
export class TypeScriptBasicRules {
	private readonly boolean_expression: BooleanExpressionContract;
	private readonly assignment_value_predicates: TypeScriptAssignmentValuePredicatesContract;
	private readonly declaration_predicates: DeclarationPredicates;
	private readonly alias_pair: TypeScriptAliasPair;

	/** Responsibilities: _complex default reporting_. **/
	private append_default_rule(
		node: ts.ParameterDeclaration,
		initializer: ts.Expression,
		append_rule: RuleAppender,
	): void {
		if (this.assignment_value_predicates.primitive_expression(initializer)) {
			return;
		}
		if (this.assignment_value_predicates.enum_member_default(initializer)) {
			return;
		}
		append_rule(node, COMPLEX_DEFAULT);
	}

	/** Responsibilities: _basic rule dependency initialization_. **/
	public constructor(variable_declaration_index: TypeScriptVariableDeclarationIndexContract) {
		this.declaration_predicates = new DeclarationPredicates();
		this.alias_pair = new TypeScriptAliasPair();
		this.boolean_expression = new TypeScriptBooleanExpression(variable_declaration_index);
		this.assignment_value_predicates = new TypeScriptAssignmentValuePredicates(
			this.boolean_expression,
			variable_declaration_index,
		);
	}

	/** Responsibilities: _parameter rule collection_. **/
	public append_parameter_rules(node: ts.Node, append_rule: RuleAppender): void {
		if (ts.isParameter(node)) {
			const initializer = node.initializer;
			if (initializer !== undefined) {
				this.append_default_rule(node, initializer, append_rule);
			}
		}
		if (this.declaration_predicates.parameter_property(node)) {
			append_rule(node, PARAMETER_PROPERTY);
		}
	}

	/** Responsibilities: _alias rule collection_. **/
	public append_alias_rules(node: ts.Node, append_rule: RuleAppender): void {
		if (this.alias_pair.alias_pair(node)) {
			append_rule(node, SINGULAR_PLURAL_ALIAS);
		}
	}
}
