import { TypeScriptStaticExpressionValueEvaluator } from "src/parser/typescript-aliases/callables/type_script_static_expression_value_evaluator";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { StaticExpressionOperationsContract } from "src/shared_services_protocols";
import ts from "typescript";

/** Responsibilities: _static expression unwrapping_, _literal value coordination_. **/
export class TypeScriptStaticExpressionOperations implements StaticExpressionOperationsContract {
	private readonly _literal_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly _expression_names: ExpressionNamesContract;

	/** Responsibilities: _static expression operation initialization_. **/
	public constructor() {
		this._literal_kinds = new Set([
			ts.SyntaxKind.StringLiteral,
			ts.SyntaxKind.NoSubstitutionTemplateLiteral,
			ts.SyntaxKind.NumericLiteral,
		]);
		this._expression_names = new TypeScriptExpressionNames();
	}

	/** Responsibilities: _static expression unwrapping_. **/
	public unwrapped(expression: ts.Expression): ts.Expression {
		let current_expression = expression;
		while (true) {
			if (ts.isParenthesizedExpression(current_expression)) {
				current_expression = current_expression.expression;
				continue;
			}
			if (ts.isNonNullExpression(current_expression) || ts.isAsExpression(current_expression)) {
				current_expression = current_expression.expression;
				continue;
			}
			if (ts.isTypeAssertionExpression(current_expression) || ts.isSatisfiesExpression(current_expression)) {
				current_expression = current_expression.expression;
				continue;
			}
			return current_expression;
		}
	}

	/** Responsibilities: _static literal lookup_. **/
	public literal(values: ReadonlyMap<string, string>, expression: ts.Expression): string {
		const evaluator = new TypeScriptStaticExpressionValueEvaluator(
			values,
			this,
			this._literal_kinds,
			this._expression_names,
		);
		return evaluator.literal(expression);
	}

	/** Responsibilities: _static value insertion_. **/
	public append(values: Map<string, string>, name: string, initializer: ts.Expression): boolean {
		if (values.has(name)) {
			return false;
		}
		const evaluator = new TypeScriptStaticExpressionValueEvaluator(
			values,
			this,
			this._literal_kinds,
			this._expression_names,
		);
		const value = evaluator.value(initializer);
		if (value.length === 0) {
			return false;
		}
		values.set(name, value);
		return true;
	}
}
