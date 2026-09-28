import ts from 'typescript';
import type { RuleContextData } from 'src/types';
import { SINGLE_ARRAY_STATE } from 'src/bridge/ts/parser-internals/constants';
import { TypeScriptArrayStateInspector } from 'src/bridge/ts/parser-internals/type-union-rules/array-state-inspector';

/** Responsibilities: _detection zero-index array access_. **/
export class TypeScriptArrayStateRules {
	private readonly array_rule_id = SINGLE_ARRAY_STATE;
	private readonly inspector = new TypeScriptArrayStateInspector();
	private readonly strict_undefined_operators = new Set([
		ts.SyntaxKind.ExclamationEqualsEqualsToken,
		ts.SyntaxKind.EqualsEqualsEqualsToken,
	]);

	/** Responsibilities: _classification expression wrapper_. **/
	private is_wrapper(expression: ts.Expression): boolean {
		if (ts.isParenthesizedExpression(expression) || ts.isNonNullExpression(expression)) {
			return true;
		}
		if (ts.isAsExpression(expression)) {
			return true;
		}
		return ts.isTypeAssertionExpression(expression) || ts.isSatisfiesExpression(expression);
	}

	/** Responsibilities: _unwrapping one expression_. **/
	private wrapper_expression(expression: ts.Expression): ts.Expression {
		if (ts.isParenthesizedExpression(expression) || ts.isNonNullExpression(expression)) {
			return expression.expression;
		}
		if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
			return expression.expression;
		}
		if (ts.isSatisfiesExpression(expression)) {
			return expression.expression;
		}
		return expression;
	}

	/** Responsibilities: _unwrapping parenthesized expression_. **/
	private unwrapped_expression(expression: ts.Expression): ts.Expression {
		while (this.is_wrapper(expression)) {
			expression = this.wrapper_expression(expression);
		}
		return expression;
	}

	/** Responsibilities: _numeric unary evaluation_. **/
	private numeric_unary(expression: ts.PrefixUnaryExpression): number {
		const value = this.numeric_value(expression.operand);
		if (Number.isNaN(value)) {
			return Number.NaN;
		}
		if (expression.operator === ts.SyntaxKind.PlusToken) {
			return value;
		}
		if (expression.operator === ts.SyntaxKind.MinusToken) {
			return -value;
		}
		return Number.NaN;
	}

	/** Responsibilities: _numeric operator evaluation_. **/
	private numeric_operation(kind: ts.SyntaxKind, left: number, right: number): number {
		if (kind === ts.SyntaxKind.PlusToken) {
			return left + right;
		}
		if (kind === ts.SyntaxKind.MinusToken) {
			return left - right;
		}
		if (kind === ts.SyntaxKind.AsteriskToken) {
			return left * right;
		}
		if (kind === ts.SyntaxKind.SlashToken) {
			return left / right;
		}
		if (kind === ts.SyntaxKind.PercentToken) {
			return left % right;
		}
		return Number.NaN;
	}

	/** Responsibilities: _numeric binary evaluation_. **/
	private numeric_binary(expression: ts.BinaryExpression): number {
		const left = this.numeric_value(expression.left);
		const right = this.numeric_value(expression.right);
		if (Number.isNaN(left) || Number.isNaN(right)) {
			return Number.NaN;
		}
		return this.numeric_operation(expression.operatorToken.kind, left, right);
	}

	/** Responsibilities: _numeric expression evaluation_. **/
	private numeric_value(expression: ts.Expression): number {
		expression = this.unwrapped_expression(expression);
		if (ts.isNumericLiteral(expression)) {
			return Number(expression.text.replaceAll('_', ''));
		}
		if (ts.isPrefixUnaryExpression(expression)) {
			return this.numeric_unary(expression);
		}
		if (ts.isBinaryExpression(expression)) {
			return this.numeric_binary(expression);
		}
		return Number.NaN;
	}

	/** Responsibilities: _resolution undefined operand name_. **/
	private undefined_operand_name(expression: ts.BinaryExpression): string {
		if (ts.isIdentifier(expression.left) && expression.right.getText() === 'undefined') {
			return expression.left.text;
		}
		if (ts.isIdentifier(expression.right) && expression.left.getText() === 'undefined') {
			return expression.right.text;
		}
		return '';
	}

	/** Responsibilities: _resolution name guarded against_. **/
	private undefined_guard_name(expression: ts.Expression): string {
		expression = this.unwrapped_expression(expression);
		if (!ts.isBinaryExpression(expression)) {
			return '';
		}
		if (!this.strict_undefined_operators.has(expression.operatorToken.kind)) {
			return '';
		}
		return this.undefined_operand_name(expression);
	}

	/** Responsibilities: _classification statement assigns zero-index_. **/
	private zero_index_assignment(statement: ts.Statement, name: string): boolean {
		if (!ts.isVariableStatement(statement)) {
			return false;
		}
		return statement.declarationList.declarations.some(declaration => {
				if (!ts.isIdentifier(declaration.name)) {
					return false;
				}
				if (declaration.name.text !== name) {
					return false;
			}
			const initializer = declaration.initializer;
				if (initializer === undefined) {
					return false;
				}
			const unwrapped = this.unwrapped_expression(initializer);
				if (!ts.isElementAccessExpression(unwrapped)) {
				return false;
			}
			const argument = unwrapped.argumentExpression;
			return argument !== undefined && this.numeric_value(argument) === 0;
		});
	}

	/** Responsibilities: _classification node guards zero-index_. **/
	private statement_list(node: ts.Statement): readonly ts.Statement[] {
		const parent = node.parent;
		if (ts.isSourceFile(parent) || ts.isBlock(parent) || ts.isModuleBlock(parent)) {
			return parent.statements;
		}
		if (ts.isCaseClause(parent) || ts.isDefaultClause(parent)) {
			return parent.statements;
		}
		return [];
	}

	/** Responsibilities: _previous sibling statement_. **/
	private previous_statement(
		node: ts.Statement,
		check: (statement: ts.Statement) => boolean
	): boolean {
		const statements = this.statement_list(node);
		const position = statements.indexOf(node);
		if (position <= 0) {
			return false;
		}
		const previous = statements[position - 1];
		if (previous === undefined) {
			return false;
		}
		return check(previous);
	}

	/** Responsibilities: _classification node guards zero-index_. **/
	private zero_index_guard(node: ts.Node): boolean {
		if (!ts.isIfStatement(node)) {
			return false;
		}
		const name = this.undefined_guard_name(node.expression);
		if (name.length === 0) {
			return false;
		}
		return this.previous_statement(node, previous => this.zero_index_assignment(previous, name));
	}

	/** Responsibilities: _reporting node accesses array_. **/
	public array_access(node: ts.Node, source_file: ts.SourceFile): boolean {
		if (ts.isElementAccessExpression(node)) {
			return this.inspector.single_item_access(node, source_file);
		}
		if (ts.isCallExpression(node)) {
			return this.inspector.single_item_method(node, source_file);
		}
		return false;
	}

	/** Responsibilities: _aggregation single-item array-state diagnostics_. **/
	public append(node: ts.Node, context: RuleContextData): void {
if (this.array_access(node, context.source_file) || this.zero_index_guard(node)) {
			context.append_rule(node, this.array_rule_id);
		}
	}
}
