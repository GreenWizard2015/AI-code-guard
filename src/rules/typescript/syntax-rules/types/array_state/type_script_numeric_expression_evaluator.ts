import type { TypeScriptNumericExpressionEvaluatorContract } from "src/rules/typescript/syntax-rules/types";
import ts from "typescript";

/** Responsibilities: _numeric expression evaluation_, _numeric expression caching_. **/
export class TypeScriptNumericExpressionEvaluator implements TypeScriptNumericExpressionEvaluatorContract {
	private readonly _unwrapped_expressions: WeakMap<ts.Expression, ts.Expression>;
	private readonly _numeric_values: WeakMap<ts.Expression, number>;

	/** Responsibilities: _transparent expression unwrapping_. **/
	private transparent_expression(wrapper_expression: ts.Expression): ts.Expression {
		if (ts.isParenthesizedExpression(wrapper_expression)) {
			return wrapper_expression.expression;
		}
		if (ts.isNonNullExpression(wrapper_expression)) {
			return wrapper_expression.expression;
		}
		if (ts.isAsExpression(wrapper_expression)) {
			return wrapper_expression.expression;
		}
		if (ts.isTypeAssertionExpression(wrapper_expression)) {
			return wrapper_expression.expression;
		}
		if (ts.isSatisfiesExpression(wrapper_expression)) {
			return wrapper_expression.expression;
		}
		return wrapper_expression;
	}

	/** Responsibilities: _prefix numeric operation_. **/
	private prefix_value(prefix_expression: ts.PrefixUnaryExpression): number {
		const operand_value = this.value(prefix_expression.operand);
		if (Number.isNaN(operand_value)) {
			return Number.NaN;
		}
		switch (prefix_expression.operator) {
			case ts.SyntaxKind.PlusToken:
				return operand_value;
			case ts.SyntaxKind.MinusToken:
				return -operand_value;
			default:
				return Number.NaN;
		}
	}

	/** Responsibilities: _binary arithmetic operator application_. **/
	private apply_binary_operator(operator: ts.SyntaxKind, left_operand: number, right_operand: number): number {
		switch (operator) {
			case ts.SyntaxKind.PlusToken:
				return left_operand + right_operand;
			case ts.SyntaxKind.MinusToken:
				return left_operand - right_operand;
			case ts.SyntaxKind.AsteriskToken:
				return left_operand * right_operand;
			case ts.SyntaxKind.SlashToken:
				return left_operand / right_operand;
			case ts.SyntaxKind.PercentToken:
				return left_operand % right_operand;
			default:
				return Number.NaN;
		}
	}

	/** Responsibilities: _binary numeric operation_. **/
	private binary_value(binary_expression: ts.BinaryExpression): number {
		const left_operand = this.value(binary_expression.left);
		const right_operand = this.value(binary_expression.right);
		if (Number.isNaN(left_operand) || Number.isNaN(right_operand)) {
			return Number.NaN;
		}
		return this.apply_binary_operator(binary_expression.operatorToken.kind, left_operand, right_operand);
	}

	/** Responsibilities: _numeric expression evaluation_. **/
	private evaluate(numeric_candidate: ts.Expression): number {
		if (ts.isNumericLiteral(numeric_candidate)) {
			return Number(numeric_candidate.text.replaceAll("_", ""));
		}
		if (ts.isPrefixUnaryExpression(numeric_candidate)) {
			return this.prefix_value(numeric_candidate);
		}
		if (ts.isBinaryExpression(numeric_candidate)) {
			return this.binary_value(numeric_candidate);
		}
		return Number.NaN;
	}

	/** Responsibilities: _numeric expression cache initialization_. **/
	public constructor() {
		this._unwrapped_expressions = new WeakMap<ts.Expression, ts.Expression>();
		this._numeric_values = new WeakMap<ts.Expression, number>();
	}

	/** Responsibilities: _unwrapped expression resolution_. **/
	public unwrap(source_expression: ts.Expression): ts.Expression {
		const cached = this._unwrapped_expressions.get(source_expression);
		if (cached !== undefined) {
			return cached;
		}
		let unwrapped = source_expression;
		while (true) {
			const inner_expression = this.transparent_expression(unwrapped);
			if (inner_expression === unwrapped) {
				break;
			}
			unwrapped = inner_expression;
		}
		this._unwrapped_expressions.set(source_expression, unwrapped);
		return unwrapped;
	}

	/** Responsibilities: _numeric expression resolution_. **/
	public value(source_expression: ts.Expression): number {
		const cached = this._numeric_values.get(source_expression);
		if (cached !== undefined) {
			return cached;
		}
		const value = this.evaluate(this.unwrap(source_expression));
		this._numeric_values.set(source_expression, value);
		return value;
	}
}
