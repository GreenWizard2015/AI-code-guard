import { TypeScriptBooleanExpression } from 'src/bridge/ts/parser-internals/typescript-boolean-expression';
import { ValueRules } from 'src/bridge/ts/runner/value-rules';
import ts from 'typescript';


/** Responsibilities: _classification allowed primitive defaults_. **/
export class TypeScriptAssignmentValuePredicates {
	private readonly boolean_expression = new TypeScriptBooleanExpression();
	private readonly logical_assignment_kinds = new Set([
		ts.SyntaxKind.QuestionQuestionEqualsToken,
		ts.SyntaxKind.BarBarEqualsToken,
		ts.SyntaxKind.AmpersandAmpersandEqualsToken,
	]);

	private readonly primitive_literal_kinds = new Set([
		ts.SyntaxKind.NullKeyword,
		ts.SyntaxKind.TrueKeyword,
		ts.SyntaxKind.FalseKeyword,
	]);

	/** Responsibilities: _identification primitive literal assignment_. **/
	private primitive_literal(expression: ts.Expression): boolean {
		if (this.is_literal_expression(expression)) {
			return true;
		}
		return this.primitive_literal_kinds.has(expression.kind);
	}

	/** Responsibilities: _identification simple default values_. **/
	private simple_default_value(expression: ts.Expression): boolean {
		if (this.primitive_literal(expression)) {
			return true;
		}
		if (ts.isArrayLiteralExpression(expression)) {
			return expression.elements.length === 0;
		}
		if (ts.isObjectLiteralExpression(expression)) {
			return expression.properties.length === 0;
		}
		return false;
	}

	/** Responsibilities: _classification literal expressions usage_. **/
	private is_literal_expression(expression: ts.Expression): boolean {
		if (ts.isStringLiteral(expression)) {
			return true;
		}
		if (ts.isNumericLiteral(expression)) {
			return true;
		}
		if (ts.isBigIntLiteral(expression)) {
			return true;
		}
		return ts.isNoSubstitutionTemplateLiteral(expression);
	}

	/** Responsibilities: _classification both sides expression_. **/
	private boolean_operands(
		left: ts.Expression,
		right: ts.Expression,
		source_file: ts.SourceFile
	): boolean {
		if (!this.boolean_expression.boolean_expression(left, source_file)) {
			return false;
		}
		return this.boolean_expression.boolean_expression(right, source_file);
	}

	/** Responsibilities: _classification operand primitive expression_. **/
	private primitive_operand(
		expression: ts.Expression,
		source_file: ts.SourceFile,
		value_rules: ValueRules
	): boolean {
		if (this.primitive_literal(expression)) {
			return true;
		}
		return value_rules.typed_primitive(expression, source_file);
	}

	/** Responsibilities: _classification binary assignment whose_. **/
	private conditional_assignment_node(node: ts.BinaryExpression): boolean {
		if (!ts.isBinaryExpression(node.parent)) {
			return false;
		}
		const parent = node.parent;
		if (this.boolean_expression.logical_operator(parent)) {
			return false;
		}
		if (parent.right !== node) {
			return false;
		}
		return parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
	}

	/** Responsibilities: _reporting assignment operand satisfies_. **/
	public operand_allowed(
		left: ts.Expression,
		right: ts.Expression,
		source_file: ts.SourceFile
	): boolean {
		if (this.boolean_operands(left, right, source_file)) {
			return true;
		}
		const value_rules = new ValueRules();
		if (!this.primitive_operand(left, source_file, value_rules)) {
			return false;
		}
		return this.primitive_operand(right, source_file, value_rules);
	}

	/** Responsibilities: _reporting conditional assignments require_. **/
	public conditional_assignment(node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		if (!ts.isBinaryExpression(node.parent)) {
			const parent = node.parent;
			return ts.isVariableDeclaration(parent) && parent.initializer === node;
		}
		return this.conditional_assignment_node(node);
	}

	/** Responsibilities: _reporting logical assignments violate_. **/
	public logical_assignment(node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		const operator_kind = node.operatorToken.kind;
		return this.logical_assignment_kinds.has(operator_kind);
	}

	/** Responsibilities: _reporting expression permitted primitive_. **/
	public primitive_expression(expression: ts.Expression): boolean {
		if (ts.isParenthesizedExpression(expression)) {
			return this.simple_default_value(expression.expression);
		}
		return this.simple_default_value(expression);
	}
}
