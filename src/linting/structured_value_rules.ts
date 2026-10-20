import ts from "typescript";
import type { StaticExpressionValuesContract } from "src/shared_services_protocols";

/** Responsibilities: _structured key resolution_, _value expression classification_. **/
export class StructuredValueRules {
	private readonly static_expression_values: StaticExpressionValuesContract;
	private readonly structured_names: Set<string>;

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
		while (this.key_wrapper(expression)) {
			if (ts.isParenthesizedExpression(expression) || ts.isNonNullExpression(expression)) {
				expression = expression.expression;
				continue;
			}
			if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
				expression = expression.expression;
				continue;
			}
			if (ts.isSatisfiesExpression(expression)) {
				expression = expression.expression;
			}
		}
		return expression;
	}

	/** Responsibilities: _structured value rule initialization_. **/
	public constructor(static_expression_values: StaticExpressionValuesContract) {
		this.structured_names = new Set(["structuredContent", "unwrap_tool_result"]);
		this.static_expression_values = static_expression_values;
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
		return this.static_expression_values.value(argument, node);
	}

	/** Responsibilities: _structured result value_. **/
	public structured_value(node: ts.Node): boolean {
		if (ts.isIdentifier(node)) {
			return this.structured_names.has(node.text);
		}
		if (!ts.isElementAccessExpression(node)) {
			return false;
		}
		const key = this.structured_key(node);
		if (key.length === 0) {
			return false;
		}
		return this.structured_names.has(key);
	}
}
