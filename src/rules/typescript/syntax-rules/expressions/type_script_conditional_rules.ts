import { CONDITIONAL_EXECUTION, LOGICAL_ASSIGNMENT, TERNARY } from "src/parser/internals/constants";
import { TypeScriptAssignmentContext } from "src/parser/internals/type_script_assignment_context";
import { TypeScriptAssignmentValuePredicates } from "src/parser/internals/type_script_assignment_value_predicates";
import { TypeScriptBooleanExpression } from "src/parser/internals/type_script_boolean_expression";
import { TypeScriptConditionalParentIndex } from "src/rules/typescript/syntax-rules/expressions/type_script_conditional_parent_index";
import { TypeScriptExpressionContainers } from "src/rules/typescript/syntax-rules/expressions/type_script_expression_containers";
import { TypeScriptNonBooleanCallAnalysis } from "src/rules/typescript/syntax-rules/expressions/type_script_non_boolean_call_analysis";
import type { BooleanExpressionContract } from "src/runtime_protocols";
import type { CallableRuleAppender } from "src/types";
import type {
	TypeScriptAssignmentContextContract,
	TypeScriptAssignmentValuePredicatesContract,
	TypeScriptConditionalParentIndexContract,
	TypeScriptConditionalRulesContract,
	TypeScriptConditionalSource,
	TypeScriptVariableDeclarationIndexContract,
} from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _conditional expression diagnostics_, _conditional value analysis_. **/
export class TypeScriptConditionalRules implements TypeScriptConditionalRulesContract {
	private readonly _assignment_context: TypeScriptAssignmentContextContract;
	private readonly _assignment_value_predicates: TypeScriptAssignmentValuePredicatesContract;
	private readonly _boolean_expression: BooleanExpressionContract;
	private readonly _conditional_parent_index: TypeScriptConditionalParentIndexContract;
	private readonly _non_boolean_analysis: TypeScriptNonBooleanCallAnalysis;
	private readonly _primitive_type_kinds: ReadonlySet<ts.SyntaxKind>;

	/** Responsibilities: _pure conditional classification_. **/
	private pure_conditional(pure_source: TypeScriptConditionalSource): boolean {
		if (!ts.isBinaryExpression(pure_source.node)) {
			return false;
		}
		const node = pure_source.node;
		if (!this._conditional_parent_index.conditional_parent(node)) {
			return false;
		}
		let parent = node.parent;
		while (ts.isParenthesizedExpression(parent)) {
			parent = parent.parent;
		}
		if (ts.isReturnStatement(parent)) {
			return false;
		}
		return !this._non_boolean_analysis.contains_non_boolean(node, pure_source.source_file);
	}

	/** Responsibilities: _conditional operand policy_. **/
	private requires_explicit_branch(value_source: TypeScriptConditionalSource): boolean {
		if (this.pure_conditional(value_source)) {
			return false;
		}
		const expression = value_source.node;
		if (!ts.isBinaryExpression(expression)) {
			return false;
		}
		return !this._assignment_value_predicates.operand_allowed(
			expression.left,
			expression.right,
			value_source.source_file,
		);
	}

	/** Responsibilities: _logical expression assignment context_. **/
	private ordinary_conditional_execution(conditional_source: TypeScriptConditionalSource): boolean {
		const branch_expression = conditional_source.node;
		if (!ts.isBinaryExpression(branch_expression)) {
			return false;
		}
		let parent = branch_expression.parent;
		while (ts.isParenthesizedExpression(parent)) {
			parent = parent.parent;
		}
		if (!ts.isExpressionStatement(parent)) {
			if (!this._conditional_parent_index.conditional_parent(branch_expression)) {
				return this.conditional_assignment_execution(conditional_source);
			}
		}
		return this.requires_explicit_branch(conditional_source);
	}

	/** Responsibilities: _nullish fallback classification_. **/
	private non_boolean_fallback(fallback_source: TypeScriptConditionalSource): boolean {
		const { node: fallback, source_file } = fallback_source;
		if (!ts.isExpression(fallback)) {
			return false;
		}
		if (!ts.isBinaryExpression(fallback)) {
			return this._non_boolean_analysis.detects_nonboolean_call(fallback, source_file);
		}
		if (!this._boolean_expression.logical_operator(fallback)) {
			return false;
		}
		return this._non_boolean_analysis.contains_non_boolean(fallback, source_file);
	}

	/** Responsibilities: _conditional execution classification_. **/
	private is_conditional_execution(execution_source: TypeScriptConditionalSource): boolean {
		if (!ts.isBinaryExpression(execution_source.node)) {
			return false;
		}
		const logical_expression = execution_source.node;
		if (!this._boolean_expression.logical_operator(logical_expression)) {
			return false;
		}
		if (logical_expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
			return this.non_boolean_fallback({
				node: logical_expression.right,
				source_file: execution_source.source_file,
			});
		}
		return this.ordinary_conditional_execution(execution_source);
	}

	/** Responsibilities: _conditional assignment execution_. **/
	private conditional_assignment_execution(assignment_source: TypeScriptConditionalSource): boolean {
		const assignment_expression = assignment_source.node;
		if (!ts.isBinaryExpression(assignment_expression)) {
			return false;
		}
		if (!this._assignment_context.conditional_assignment(assignment_expression)) {
			return false;
		}
		if (!this._non_boolean_analysis.contains_non_boolean(assignment_expression, assignment_source.source_file)) {
			return false;
		}
		return this.requires_explicit_branch(assignment_source);
	}

	/** Responsibilities: _primitive type identification_. **/
	private primitive_assignment(node: ts.ConditionalExpression): boolean {
		const parent = node.parent;
		if (!ts.isVariableDeclaration(parent)) {
			return false;
		}
		if (parent.initializer !== node) {
			return false;
		}
		if (parent.type === undefined) {
			return false;
		}
		return this._primitive_type_kinds.has(parent.type.kind);
	}

	/** Responsibilities: _ternary rule classification_. **/
	private append_ternary(candidate: ts.Node): boolean {
		if (!ts.isConditionalExpression(candidate)) {
			return false;
		}
		const complex_true = !this._assignment_value_predicates.primitive_expression(candidate.whenTrue);
		const complex_false = !this._assignment_value_predicates.primitive_expression(candidate.whenFalse);
		const complex_branch = complex_true || complex_false;
		if (!complex_branch) {
			return false;
		}
		if (this.primitive_assignment(candidate)) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _conditional execution classification_. **/
	private append_conditional_execution(execution_source: TypeScriptConditionalSource): boolean {
		const { node: candidate, source_file } = execution_source;
		if (ts.isCallExpression(candidate)) {
			return candidate.questionDotToken !== undefined;
		}
		if (ts.isPropertyAccessExpression(candidate) || ts.isElementAccessExpression(candidate)) {
			if (candidate.questionDotToken !== undefined) {
				return true;
			}
		}
		if (!ts.isBinaryExpression(candidate)) {
			return false;
		}
		const source: TypeScriptConditionalSource = { node: candidate, source_file };
		return this.is_conditional_execution(source);
	}

	/** Responsibilities: _conditional rule composition_. **/
	public constructor(variable_declaration_index: TypeScriptVariableDeclarationIndexContract) {
		this._primitive_type_kinds = new Set([
			ts.SyntaxKind.StringKeyword,
			ts.SyntaxKind.NumberKeyword,
			ts.SyntaxKind.BooleanKeyword,
			ts.SyntaxKind.BigIntKeyword,
			ts.SyntaxKind.NullKeyword,
			ts.SyntaxKind.UndefinedKeyword,
		]);
		this._boolean_expression = new TypeScriptBooleanExpression(variable_declaration_index);
		this._non_boolean_analysis = new TypeScriptNonBooleanCallAnalysis(this._boolean_expression);
		this._assignment_context = new TypeScriptAssignmentContext(this._boolean_expression);
		const expression_containers = new TypeScriptExpressionContainers();
		this._conditional_parent_index = new TypeScriptConditionalParentIndex(expression_containers);
		this._assignment_value_predicates = new TypeScriptAssignmentValuePredicates(
			this._boolean_expression,
			variable_declaration_index,
		);
	}

	/** Responsibilities: _conditional rule collection_. **/
	public append(candidate_node: ts.Node, source_file: ts.SourceFile, append_rule: CallableRuleAppender): void {
		if (this._assignment_context.logical_assignment(candidate_node)) {
			append_rule(candidate_node, LOGICAL_ASSIGNMENT);
		}
		if (this.append_ternary(candidate_node)) {
			append_rule(candidate_node, TERNARY);
		}
		if (this.append_conditional_execution({ node: candidate_node, source_file })) {
			append_rule(candidate_node, CONDITIONAL_EXECUTION);
		}
	}
}
