import ts from "typescript";
import { TypeScriptReferenceType } from "src/parser/analysis/type_script_reference_type";
import type { TypeScriptCallReturnAnalysisContract } from "src/typescript_analysis_protocols";

/** Responsibilities: _invocation result expressions_, _reference owner resolution_. **/
export class TypeScriptCallReturnAnalysis implements TypeScriptCallReturnAnalysisContract {
	private readonly reference_type = TypeScriptReferenceType;

	/** Responsibilities: _extraction expression wrapped syntax_. **/
	private wrapped_expression(expression: ts.Expression): ts.Expression {
		if (ts.isAwaitExpression(expression) || ts.isParenthesizedExpression(expression)) {
			return expression.expression;
		}
		if (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)) {
			return expression.expression;
		}
		if (ts.isTypeAssertionExpression(expression)) {
			return expression.expression;
		}
		return expression;
	}

	/** Responsibilities: _resolution owner represented output_. **/
	public reference_owner(type: ts.TypeNode): string {
		const reference = new this.reference_type(type);
		const owner = reference.return_owner();
		if (owner.length > 0) {
			return owner;
		}
		return "";
	}

	/** Responsibilities: _unwrap nested output expressions_. **/
	public unwrapped_expression(expression: ts.Expression): ts.Expression {
		let current = expression;
		while (true) {
			const next = this.wrapped_expression(current);
			if (next === current) {
				return current;
			}
			current = next;
		}
	}

	/** Responsibilities: _legacy wrapped expression collection_. **/
	public unwrap_expression(expression: ts.Expression): ts.Expression[] {
		return [this.unwrapped_expression(expression)];
	}
}
