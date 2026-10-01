import ts from "typescript";
import { TypeScriptAssignmentPredicates } from "src/bridge/ts/parser-internals/typescript-assignment-predicates";
import { TypeScriptAssignmentValuePredicates } from "src/bridge/ts/parser-internals/typescript-assignment-value-predicates";
import { TypeScriptBooleanExpression } from "src/bridge/ts/parser-internals/typescript-boolean-expression";
import { TypeScriptBooleanCall } from "src/bridge/ts/parser-internals/typescript-boolean-call";
import { TypeScriptExpressionContainers } from "src/bridge/ts/parser-internals/typescript-expression-containers";
import type { RuleAppender } from "src/types";
import {
	CONDITIONAL_EXECUTION,
	LOGICAL_ASSIGNMENT,
	SWITCH,
	TERNARY,
	TS_BLOCK,
} from "src/bridge/ts/parser-internals/constants";

/** Responsibilities: _classification TypeScript conditional rules_. **/
export class TypeScriptConditionalRules {
	private readonly script_assignment_predicates = new TypeScriptAssignmentPredicates();
	private readonly assignment_value_predicates = new TypeScriptAssignmentValuePredicates();
	private readonly boolean_expression = new TypeScriptBooleanExpression();
	private readonly boolean_call = new TypeScriptBooleanCall();
	private readonly expression_containers = new TypeScriptExpressionContainers();

	/** Responsibilities: _conditional statement parent classification_. **/
	private branch_condition_parent(container: ts.Node, current: ts.Node): boolean {
		if (ts.isIfStatement(container)) {
			return container.expression === current;
		}
		if (ts.isWhileStatement(container)) {
			return container.expression === current;
		}
		if (ts.isDoStatement(container)) {
			return container.expression === current;
		}
		if (ts.isForStatement(container)) {
			return container.condition === current;
		}
		return false;
	}

	/** Responsibilities: _conditional expression parent classification_. **/
	private expression_condition_parent(container: ts.Node, current: ts.Node): boolean {
		if (ts.isReturnStatement(container)) {
			return container.expression === current;
		}
		if (ts.isSwitchStatement(container)) {
			return container.expression === current;
		}
		if (ts.isConditionalExpression(container)) {
			return container.condition === current;
		}
		return false;
	}

	/** Responsibilities: _conditional statement parent classification_. **/
	private statement_condition_parent(container: ts.Node, current: ts.Node): boolean {
		if (ts.isExpressionStatement(container)) {
			return container.expression === current;
		}
		if (this.branch_condition_parent(container, current)) {
			return true;
		}
		return this.expression_condition_parent(container, current);
	}

	/** Responsibilities: _conditional parent traversal_. **/
	private conditional_parent(node: ts.BinaryExpression): boolean {
		let current: ts.Node = node;
		while (current.parent !== undefined) {
			const container = current.parent;
			if (this.expression_containers.contains(container, current)) {
				current = container;
				continue;
			}
			return this.statement_condition_parent(container, current);
		}
		return false;
	}

	/** Responsibilities: _conditional assignment context_. **/
	private conditional_context(node: ts.BinaryExpression): boolean {
		let parent = node.parent;
		while (ts.isParenthesizedExpression(parent)) {
			parent = parent.parent;
		}
		if (ts.isExpressionStatement(parent)) {
			return true;
		}
		if (this.conditional_parent(node)) {
			return true;
		}
		return this.assignment_value_predicates.conditional_assignment(node);
	}

	/** Responsibilities: _pure conditional classification_. **/
	private pure_conditional(node: ts.BinaryExpression, source_file: ts.SourceFile): boolean {
		if (!this.conditional_parent(node)) {
			return false;
		}
		if (this.returned_expression(node)) {
			return false;
		}
		let has_call = false;
		const visit = (child: ts.Node): void => {
			if (ts.isCallExpression(child)) {
				if (!this.boolean_call.boolean_call(child, source_file)) {
					has_call = true;
				}
			}
			ts.forEachChild(child, visit);
		};
		visit(node);
		return !has_call;
	}

	/** Responsibilities: _binary result context_. **/
	private returned_expression(node: ts.BinaryExpression): boolean {
		let current = node.parent;
		while (ts.isParenthesizedExpression(current)) {
			current = current.parent;
		}
		return ts.isReturnStatement(current);
	}

	/** Responsibilities: _conditional execution classification_. **/
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
		return this.logical_execution(node, source_file);
	}

	/** Responsibilities: _logical execution classification_. **/
	private logical_execution(node: ts.BinaryExpression, source_file: ts.SourceFile): boolean {
		if (!this.conditional_context(node)) {
			return false;
		}
		if (this.pure_conditional(node, source_file)) {
			return false;
		}
		if (this.assignment_value_predicates.operand_allowed(node.left, node.right, source_file)) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _ternary rule aggregation_. **/
	private append_ternary_rule(node: ts.ConditionalExpression, append_rule: RuleAppender): void {
		const complex_true = !this.assignment_value_predicates.primitive_expression(node.whenTrue);
		const complex_false = !this.assignment_value_predicates.primitive_expression(node.whenFalse);
		const is_assignment = this.script_assignment_predicates.primitive_assignment(node);
		if (!complex_true && !complex_false) {
			return;
		}
		if (is_assignment) {
			return;
		}
		append_rule(node, TERNARY);
	}

	/** Responsibilities: _conditional rule aggregation_. **/
	public append(node: ts.Node, source_file: ts.SourceFile, append_rule: RuleAppender): void {
		if (this.assignment_value_predicates.logical_assignment(node)) {
			append_rule(node, LOGICAL_ASSIGNMENT);
		}
		if (ts.isSwitchStatement(node)) {
			append_rule(node, SWITCH);
		}
		if (ts.isConditionalExpression(node)) {
			this.append_ternary_rule(node, append_rule);
		}
		if (this.is_conditional_execution(node, source_file)) {
			append_rule(node, CONDITIONAL_EXECUTION);
		}
	}

	/** Responsibilities: _branch diagnostics_. **/
	public append_if_block(node: ts.Node, append_rule: RuleAppender): void {
		if (!ts.isIfStatement(node)) {
			return;
		}
		if (!ts.isBlock(node.thenStatement)) {
			append_rule(node.thenStatement, TS_BLOCK);
		}
		if (node.elseStatement === undefined) {
			return;
		}
		const is_else_if = ts.isIfStatement(node.elseStatement);
		const is_else_block = ts.isBlock(node.elseStatement);
		if (!is_else_if && !is_else_block) {
			append_rule(node.elseStatement, TS_BLOCK);
		}
	}
}
