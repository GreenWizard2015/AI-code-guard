import ts from "typescript";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/typescript-expression-aliases";
import { TypeScriptStaticArrayIndexOperations } from "src/typescript-callable-aliases/static-array/typescript-static-array-index-operations";
import type { StaticArraySourceAppender } from "src/protocols";

/** Responsibilities: _static array indexed values_. **/
export class TypeScriptStaticArrayIndexValues {
	private readonly expression_aliases = new TypeScriptExpressionAliases("");
	private readonly numeric_sources: Map<string, number>;
	private readonly index_operations = new TypeScriptStaticArrayIndexOperations();

	/** Responsibilities: _indexed array values_. **/
	private append_selected(
		values: ts.Expression[],
		index: number,
		source: readonly ts.Expression[],
		append_source: StaticArraySourceAppender,
	): boolean {
		for (const [current_index, value] of source.entries()) {
			if (current_index !== index) {
				continue;
			}
			return this.append_selected_value(values, value, append_source);
		}
		return false;
	}

	/** Responsibilities: _array value index_. **/
	private append_selected_value(
		values: ts.Expression[],
		value: ts.Expression,
		append_source: StaticArraySourceAppender,
	): boolean {
		if (ts.isArrayLiteralExpression(value)) {
			return append_source(values, value);
		}
		if (ts.isIdentifier(value)) {
			if (append_source(values, value)) {
				return true;
			}
			values.push(value);
			return true;
		}
		values.push(value);
		return true;
	}

	/** Responsibilities: _static array index_. **/
	private prefix_index(expression: ts.PrefixUnaryExpression): number {
		const value = this.numeric_index(expression.operand);
		if (value < 0) {
			return -1;
		}
		if (expression.operator === ts.SyntaxKind.PlusToken) {
			return value;
		}
		if (expression.operator === ts.SyntaxKind.MinusToken) {
			return -value;
		}
		return -1;
	}

	/** Responsibilities: _static arithmetic index_. **/
	private binary_index(expression: ts.BinaryExpression): number {
		const left = this.numeric_index(expression.left);
		const right = this.numeric_index(expression.right);
		if (left < 0 || right < 0) {
			return -1;
		}
		if (!this.index_operations.supports(expression.operatorToken.kind)) {
			return -1;
		}
		const value = this.index_operations.resolve(expression.operatorToken.kind, left, right);
		if (!Number.isInteger(value)) {
			return -1;
		}
		if (value < 0) {
			return -1;
		}
		return value;
	}

	/** Responsibilities: _static conditional index_. **/
	private conditional_index(expression: ts.ConditionalExpression): number {
		const when_true = this.numeric_index(expression.whenTrue);
		const when_false = this.numeric_index(expression.whenFalse);
		if (when_true < 0 || when_true !== when_false) {
			return -1;
		}
		return when_true;
	}

	/** Responsibilities: _named static array index_. **/
	private named_index(expression: ts.Expression): number {
		if (ts.isNumericLiteral(expression)) {
			return Number(expression.text);
		}
		if (!ts.isIdentifier(expression)) {
			return -1;
		}
		const value = this.numeric_sources.get(expression.text);
		if (value === undefined) {
			return -1;
		}
		return value;
	}

	/** Responsibilities: _static array index dependencies_. **/
	public constructor(numeric_sources: Map<string, number>) {
		this.numeric_sources = numeric_sources;
	}

	/** Responsibilities: _static array index_. **/
	public numeric_index(expression: ts.Expression): number {
		const current = this.expression_aliases.unwrapped(expression);
		if (ts.isPrefixUnaryExpression(current)) {
			return this.prefix_index(current);
		}
		if (ts.isBinaryExpression(current)) {
			return this.binary_index(current);
		}
		if (ts.isConditionalExpression(current)) {
			return this.conditional_index(current);
		}
		return this.named_index(current);
	}

	/** Responsibilities: _indexed array source values_. **/
	public append(
		values: ts.Expression[],
		expression: ts.ElementAccessExpression,
		append_source: StaticArraySourceAppender,
	): boolean {
		const argument = expression.argumentExpression;
		if (argument === undefined) {
			return false;
		}
		const index = this.numeric_index(argument);
		if (index < 0) {
			return false;
		}
		const source: ts.Expression[] = [];
		if (!append_source(source, expression.expression)) {
			return false;
		}
		return this.append_selected(values, index, source, append_source);
	}
}
