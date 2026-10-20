import ts from "typescript";
import { TypeScriptAssignmentValuePredicates } from "src/parser/internals/type_script_assignment_value_predicates";
import { TypeScriptBooleanExpression } from "src/parser/internals/type_script_boolean_expression";
import { TypeScriptExpressionContainers } from "src/rules/typescript/syntax-rules/expressions/type_script_expression_containers";
import type { BooleanExpressionContract } from "src/runtime_protocols";
import type { TypeScriptAssignmentPredicatesContract, TypeScriptAssignmentValuePredicatesContract, TypeScriptConditionalRulesContract, TypeScriptVariableDeclarationIndexContract } from "src/typescript_analysis_protocols";
import type { RuleAppender } from "src/types";
import {
	POINTLESS_BOOLEAN_OPERATION,
	CONDITIONAL_EXECUTION,
	LOGICAL_ASSIGNMENT,
	TERNARY,
	TS_BLOCK,
} from "src/parser/internals/constants";

/** Responsibilities: _conditional expression diagnostics_, _boolean identity branch diagnostics_. **/
export class TypeScriptConditionalRules implements TypeScriptConditionalRulesContract {
	private readonly script_assignment_predicates: TypeScriptAssignmentPredicatesContract;
	private readonly assignment_value_predicates: TypeScriptAssignmentValuePredicatesContract;
	private readonly boolean_expression: BooleanExpressionContract;
	private readonly expression_containers: TypeScriptExpressionContainers;
	private readonly conditional_parents: WeakMap<ts.BinaryExpression, boolean>;
	private readonly non_boolean_calls: WeakMap<ts.Node, boolean>;

	/** Responsibilities: _pure conditional classification_. **/
	private pure_conditional(node: ts.BinaryExpression, source_file: ts.SourceFile): boolean {
		if (!this.conditional_parent(node)) {
			return false;
		}
		let parent = node.parent;
		while (ts.isParenthesizedExpression(parent)) {
			parent = parent.parent;
		}
		if (ts.isReturnStatement(parent)) {
			return false;
		}
		return !this.contains_non_boolean(node, source_file);
	}

	/** Responsibilities: _conditional parent traversal_. **/
	private conditional_parent(node: ts.BinaryExpression): boolean {
		const cached = this.conditional_parents.get(node);
		if (cached !== undefined) {
			return cached;
		}
		const path: ts.BinaryExpression[] = [];
		const result = this.find_conditional_parent(node, path);
		for (const expression of path) {
			this.conditional_parents.set(expression, result);
		}
		return result;
	}

	/** Responsibilities: _binary parent path tracking_. **/
	private track_parent_path(current: ts.Node, path: ts.BinaryExpression[]): void {
		if (ts.isBinaryExpression(current)) {
			path.push(current);
		}
	}

	/** Responsibilities: _conditional parent search_. **/
	private find_conditional_parent(node: ts.BinaryExpression, path: ts.BinaryExpression[]): boolean {
		let current: ts.Node = node;
		while (current.parent !== undefined) {
			this.track_parent_path(current, path);
			const container = current.parent;
			if (!this.expression_containers.contains(container, current)) {
				return this.statement_condition_parent(container, current);
			}
			if (ts.isBinaryExpression(container)) {
				const cached = this.conditional_parents.get(container);
				if (cached !== undefined) {
					return cached;
				}
			}
			current = container;
		}
		return false;
	}

	/** Responsibilities: _conditional statement parent classification_. **/
	private statement_condition_parent(container: ts.Node, current: ts.Node): boolean {
		if (ts.isExpressionStatement(container)) {
			return container.expression === current;
		}
		if (ts.isIfStatement(container) || ts.isWhileStatement(container) || ts.isDoStatement(container)) {
			return container.expression === current;
		}
		if (ts.isForStatement(container)) {
			return container.condition === current;
		}
		if (ts.isReturnStatement(container) || ts.isSwitchStatement(container)) {
			return container.expression === current;
		}
		return ts.isConditionalExpression(container) && container.condition === current;
	}

	/** Responsibilities: _non-boolean invocation classification_. **/
	private contains_non_boolean(node: ts.Node, source_file: ts.SourceFile): boolean {
		const cached = this.non_boolean_calls.get(node);
		if (cached !== undefined) {
			return cached;
		}
		let result = ts.isCallExpression(node) && !this.boolean_expression.boolean_call(node, source_file);
		if (!result) {
			node.forEachChild((child) => {
				if (!result) {
					result = this.contains_non_boolean(child, source_file);
				}
			});
		}
		this.non_boolean_calls.set(node, result);
		return result;
	}

	/** Responsibilities: _binary result context_. **/
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
		let parent = node.parent;
		while (ts.isParenthesizedExpression(parent)) {
			parent = parent.parent;
		}
		if (!ts.isExpressionStatement(parent) && !this.conditional_parent(node)) {
			if (!this.assignment_value_predicates.conditional_assignment(node)) {
				return false;
			}
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

	/** Responsibilities: _branch statement shape_. **/
	private single_return_statement(node: ts.IfStatement): boolean {
		let statement: ts.Statement = node.thenStatement;
		if (ts.isBlock(statement)) {
			if (statement.statements.length !== 1) {
				return false;
			}
			statement = statement.statements[0];
		}
		return ts.isReturnStatement(statement);
	}

	/** Responsibilities: _boolean identity expression_. **/
	private boolean_identity_expression(expression: ts.Expression): boolean {
		if (!ts.isBinaryExpression(expression)) {
			return false;
		}
		const operator = expression.operatorToken.kind;
		if (operator !== ts.SyntaxKind.EqualsEqualsToken) {
			if (operator !== ts.SyntaxKind.EqualsEqualsEqualsToken) {
				return false;
			}
		}
		const left_boolean = this.boolean_literal(expression.left);
		const right_boolean = this.boolean_literal(expression.right);
		if (left_boolean) {
			return !right_boolean;
		}
		return right_boolean;
	}

	/** Responsibilities: _boolean identity branch_. **/
	private boolean_identity_return(node: ts.IfStatement): boolean {
		if (node.elseStatement !== undefined) {
			return false;
		}
		if (!this.single_return_statement(node)) {
			return false;
		}
		return this.boolean_identity_expression(node.expression);
	}

	/** Responsibilities: _boolean literal detection_. **/
	private boolean_literal(node: ts.Expression): boolean {
		if (node.kind === ts.SyntaxKind.TrueKeyword) {
			return true;
		}
		return node.kind === ts.SyntaxKind.FalseKeyword;
	}

	/** Responsibilities: _conditional rule aggregation_. **/
	/** Responsibilities: _conditional rule composition_. **/
	public constructor(
		script_assignment_predicates: TypeScriptAssignmentPredicatesContract,
		variable_declaration_index: TypeScriptVariableDeclarationIndexContract,
	) {
		this.boolean_expression = new TypeScriptBooleanExpression(variable_declaration_index);
		this.expression_containers = new TypeScriptExpressionContainers();
		this.conditional_parents = new WeakMap();
		this.non_boolean_calls = new WeakMap();
		this.script_assignment_predicates = script_assignment_predicates;
		this.assignment_value_predicates = new TypeScriptAssignmentValuePredicates(
			this.boolean_expression,
			variable_declaration_index,
		);
	}

	/** Responsibilities: _conditional rule collection_. **/
	public append(node: ts.Node, source_file: ts.SourceFile, append_rule: RuleAppender): void {
		if (this.assignment_value_predicates.logical_assignment(node)) {
			append_rule(node, LOGICAL_ASSIGNMENT);
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
		if (this.boolean_identity_return(node)) {
			append_rule(node, POINTLESS_BOOLEAN_OPERATION);
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
