import { TypeScriptAssignmentPredicates } from 'src/bridge/ts/parser-internals/typescript-assignment-predicates';
import { TypeScriptAssignmentValuePredicates } from 'src/bridge/ts/parser-internals/typescript-assignment-value-predicates';
import { TypeScriptBooleanExpression } from 'src/bridge/ts/parser-internals/typescript-boolean-expression';
import { TypeScriptStructuralRules } from 'src/bridge/ts/parser-internals/typescript-structural-rules';
import { TypeScriptBoundaryRuleAppender } from 'src/bridge/ts/parser-internals/type-union-rules/boundary-rule-appender';
import ts from 'typescript';
import {
	CONDITIONAL_EXECUTION,
	LOGICAL_ASSIGNMENT,
	SWITCH,
	TERNARY,
	TS_BLOCK,
} from 'src/bridge/ts/parser-internals/constants';
import type { RuleAppender, RuleContextData } from 'src/types';
/** Responsibilities: _aggregation TypeScript conditional structural_. **/
export class TypeScriptTypeRules {
	private readonly structural_rules = new TypeScriptStructuralRules();
	private readonly script_assignment_predicates = new TypeScriptAssignmentPredicates();
	private readonly assignment_value_predicates = new TypeScriptAssignmentValuePredicates();
	private readonly boolean_expression = new TypeScriptBooleanExpression();
	private readonly boundary_rules = new TypeScriptBoundaryRuleAppender();

	/** Responsibilities: _aggregation conditional-type violation AST_. **/
	private append_conditional_rule(node: ts.Node, append_rule: RuleAppender): void {
		if (!ts.isIfStatement(node)) {
			return;
		}
		if (!ts.isBlock(node.thenStatement)) {
			append_rule(node.thenStatement, TS_BLOCK);
		}
		if (node.elseStatement !== undefined) {
				const is_else_if = ts.isIfStatement(node.elseStatement);
				const is_else_block = ts.isBlock(node.elseStatement);
				if (!is_else_if && !is_else_block) {
				append_rule(node.elseStatement, TS_BLOCK);
			}
		}
	}

	/** Responsibilities: _classification node conditionally execution_. **/
	private is_conditional_execution(node: ts.Node, source_file: ts.SourceFile): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		if (!this.boolean_expression.logical_operator(node)) {
			return false;
		}
		if (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
			return true;
		}
		if (!this.assignment_value_predicates.conditional_assignment(node)) {
			return false;
		}
		if (this.assignment_value_predicates.operand_allowed(node.left, node.right, source_file)) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _aggregation conditional execution rules_. **/
	private append_conditional_rules(node: ts.Node, source_file: ts.SourceFile, append_rule: RuleAppender): void {
		if (this.assignment_value_predicates.logical_assignment(node)) {
			append_rule(node, LOGICAL_ASSIGNMENT);
		}
		if (ts.isSwitchStatement(node)) {
			append_rule(node, SWITCH);
		}
		if (ts.isConditionalExpression(node)) {
			const complex_true = !this.assignment_value_predicates.primitive_expression(node.whenTrue);
			const complex_false = !this.assignment_value_predicates.primitive_expression(node.whenFalse);
			const is_assignment = this.script_assignment_predicates.primitive_assignment(node);
			if ((complex_true || complex_false) && !is_assignment) {
			append_rule(node, TERNARY);
			}
		}
		if (this.is_conditional_execution(node, source_file)) {
			append_rule(node, CONDITIONAL_EXECUTION);
		}
	}

	/** Responsibilities: _aggregation structural type rules_. **/
	public append_structure_rules(node: ts.Node, context: RuleContextData): void {
		this.structural_rules.append(node, context);
		if (ts.isBinaryExpression(node)) {
			this.append_conditional_rules(node, context.source_file, context.append_rule);
		}
		if (ts.isSwitchStatement(node)) {
			this.append_conditional_rules(node, context.source_file, context.append_rule);
		}
		if (ts.isConditionalExpression(node)) {
			this.append_conditional_rules(node, context.source_file, context.append_rule);
		}
		if (ts.isIfStatement(node)) {
			this.append_conditional_rule(node, context.append_rule);
		}
	}

	/** Responsibilities: _aggregation type conditional rules_. **/
	public append_type_rules(node: ts.Node, context: RuleContextData): void {
		this.boundary_rules.append(node, context);
		this.append_structure_rules(node, context);
	}
}
