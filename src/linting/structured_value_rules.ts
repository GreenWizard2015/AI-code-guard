import type { StaticExpressionValuesContract } from "src/shared_services_protocols";
import ts from "typescript";

/** Responsibilities: _structured key resolution_, _value expression classification_. **/
export class StructuredValueRules {
	private readonly _static_expression_values: StaticExpressionValuesContract;
	private readonly _structured_names: Set<string>;

	/** Responsibilities: _structured key wrapper_. **/
	private key_wrapper(expression: ts.Expression): boolean {
		if (ts.isParenthesizedExpression(expression) || ts.isNonNullExpression(expression)) {
			return true;
		}
		if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
			return true;
		}
		return ts.isSatisfiesExpression(expression);
	}

	/** Responsibilities: _structured key unwrapping_. **/
	private unwrapped_key(expression: ts.Expression): ts.Expression {
		let current_expression = expression;
		while (this.key_wrapper(current_expression)) {
			if (ts.isParenthesizedExpression(current_expression) || ts.isNonNullExpression(current_expression)) {
				current_expression = current_expression.expression;
				continue;
			}
			if (ts.isAsExpression(current_expression) || ts.isTypeAssertionExpression(current_expression)) {
				current_expression = current_expression.expression;
				continue;
			}
			if (ts.isSatisfiesExpression(current_expression)) {
				current_expression = current_expression.expression;
			}
		}
		return current_expression;
	}

	/** Responsibilities: _structured value rule initialization_. **/
	public constructor(static_expression_values: StaticExpressionValuesContract) {
		this._structured_names = new Set(["structuredContent", "unwrap_tool_result"]);
		this._static_expression_values = static_expression_values;
	}

	/** Responsibilities: _structured result key_. **/
	public structured_key(node: ts.ElementAccessExpression): string {
		const argument = node.argumentExpression;
		if (argument === undefined) {
			return "";
		}
		const key = this.unwrapped_key(argument);
		if (ts.isStringLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key)) {
			return key.text;
		}
		return this._static_expression_values.value(argument, node);
	}

	/** Responsibilities: _structured result value_. **/
	public structured_value(node: ts.Node): boolean {
		if (ts.isIdentifier(node)) {
			return this._structured_names.has(node.text);
		}
		if (!ts.isElementAccessExpression(node)) {
			return false;
		}
		const key = this.structured_key(node);
		if (key.length === 0) {
			return false;
		}
		return this._structured_names.has(key);
	}
}
