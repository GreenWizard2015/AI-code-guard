import { ValueRules } from "src/linting/value_rules";
import type { BooleanExpressionContract } from "src/protocols";
import ts from "typescript";
import type {
	TypeScriptAssignmentValuePredicatesContract,
	TypeScriptVariableDeclarationIndexContract,
	ValueRulesContract,
} from "src/protocols";

/** Responsibilities: _allowed assignment value classification_, _conditional assignment checks_. **/
export class TypeScriptAssignmentValuePredicates implements TypeScriptAssignmentValuePredicatesContract {
	private readonly boolean_expression: BooleanExpressionContract;
	private readonly value_rules: ValueRulesContract;
	private readonly logical_assignment_kinds: Set<ts.SyntaxKind>;

	private readonly primitive_literal_kinds: Set<ts.SyntaxKind>;

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
	private boolean_operands(left: ts.Expression, right: ts.Expression, source_file: ts.SourceFile): boolean {
		if (!this.boolean_expression.boolean_expression(left, source_file)) {
			return false;
		}
		return this.boolean_expression.boolean_expression(right, source_file);
	}

	/** Responsibilities: _classification operand primitive expression_. **/
	private primitive_operand(
		expression: ts.Expression,
		source_file: ts.SourceFile,
		value_rules: ValueRulesContract,
	): boolean {
		if (this.primitive_literal(expression)) {
			return true;
		}
		return value_rules.typed_primitive(expression, source_file);
	}

	/** Responsibilities: _assignment boundary classification_. **/
	private binary_assignment_boundary(child: ts.Node, parent: ts.BinaryExpression): boolean {
		if (this.boolean_expression.logical_operator(parent)) {
			return true;
		}
		if (parent.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		return parent.right === child;
	}

	/** Responsibilities: _assignment boundary classification_. **/
	private assignment_boundary(child: ts.Node, parent: ts.Node): boolean {
		if (ts.isBinaryExpression(parent)) {
			return this.binary_assignment_boundary(child, parent);
		}
		if (ts.isVariableDeclaration(parent)) {
			return parent.initializer === child;
		}
		if (ts.isBindingElement(parent)) {
			return parent.initializer === child;
		}
		if (ts.isParameter(parent)) {
			return parent.initializer === child;
		}
		return false;
	}

	/** Responsibilities: _invoked function boundary classification_. **/
	private called_function(parent: ts.Node): boolean {
		let invocation = parent.parent;
		while (ts.isParenthesizedExpression(invocation)) {
			invocation = invocation.parent;
		}
		if (!ts.isCallExpression(invocation)) {
			return false;
		}
		let callee: ts.Expression = invocation.expression;
		while (ts.isParenthesizedExpression(callee)) {
			callee = callee.expression;
		}
		return callee === parent;
	}

	/** Responsibilities: _function boundary classification_. **/
	private function_boundary(parent: ts.Node): boolean {
		if (!ts.isFunctionLike(parent)) {
			return false;
		}
		return !this.called_function(parent);
	}

	/** Responsibilities: _assignment parent resolution_. **/
	private assignment_parent(node: ts.BinaryExpression): ts.Node {
		let child: ts.Node = node;
		let parent = node.parent;
		while (!ts.isSourceFile(parent)) {
			if (this.function_boundary(parent)) {
				return parent;
			}
			if (this.assignment_boundary(child, parent)) {
				return parent;
			}
			child = parent;
			parent = parent.parent;
		}
		return parent;
	}

	/** Responsibilities: _assignment context classification_. **/
	private assigned_value(node: ts.BinaryExpression): boolean {
		const parent = this.assignment_parent(node);
		if (ts.isVariableDeclaration(parent)) {
			return parent.initializer !== undefined;
		}
		if (ts.isBindingElement(parent)) {
			return parent.initializer !== undefined;
		}
		if (ts.isParameter(parent)) {
			return parent.initializer !== undefined;
		}
		if (!ts.isBinaryExpression(parent)) {
			return false;
		}
		return parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
	}

	/** Responsibilities: _enum member value classification_. **/
	private enum_member_value(declaration: ts.EnumDeclaration, member_name: string): boolean {
		return declaration.members.some((member) => {
			if (member.name.getText() !== member_name) {
				return false;
			}
			const initializer = member.initializer;
			if (initializer === undefined) {
				return false;
			}
			return this.primitive_expression(initializer);
		});
	}

	/** Responsibilities: _assignment predicate dependency initialization_. **/
	public constructor(
		boolean_expression: BooleanExpressionContract,
		variable_declaration_index: TypeScriptVariableDeclarationIndexContract,
	) {
		this.logical_assignment_kinds = new Set([
			ts.SyntaxKind.QuestionQuestionEqualsToken,
			ts.SyntaxKind.BarBarEqualsToken,
			ts.SyntaxKind.AmpersandAmpersandEqualsToken,
		]);
		this.primitive_literal_kinds = new Set([
			ts.SyntaxKind.NullKeyword,
			ts.SyntaxKind.TrueKeyword,
			ts.SyntaxKind.FalseKeyword,
		]);
		this.boolean_expression = boolean_expression;
		this.value_rules = new ValueRules(variable_declaration_index);
	}

	/** Responsibilities: _reporting assignment operand satisfies_. **/
	public operand_allowed(left: ts.Expression, right: ts.Expression, source_file: ts.SourceFile): boolean {
		if (this.boolean_operands(left, right, source_file)) {
			return true;
		}
		if (!this.primitive_operand(left, source_file, this.value_rules)) {
			return false;
		}
		return this.primitive_operand(right, source_file, this.value_rules);
	}

	/** Responsibilities: _reporting conditional assignments require_. **/
	public conditional_assignment(node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		return this.assigned_value(node);
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

	/** Responsibilities: _enum member default classification_. **/
	public enum_member_default(expression: ts.Expression): boolean {
		if (!ts.isPropertyAccessExpression(expression)) {
			return false;
		}
		if (!ts.isIdentifier(expression.expression)) {
			return false;
		}
		const enum_name = expression.expression.text;
		const member_name = expression.name.text;
		const enum_declarations = expression.getSourceFile().statements.filter(ts.isEnumDeclaration);
		return enum_declarations.some((declaration) => {
			if (declaration.name.text !== enum_name) {
				return false;
			}
			return this.enum_member_value(declaration, member_name);
		});
	}
}
