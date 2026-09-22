import ts from 'typescript';
import { TypeScriptReferenceType } from 'src/parser/ts/typescript-reference-type';

/** Responsibilities: _invocation result expressions_, _reference owner resolution_. **/
export class TypeScriptCallReturnAnalysis {
	private readonly reference_type = TypeScriptReferenceType;

	/** Responsibilities: _extraction expression wrapped syntax_. **/
	private wrapped_expression(expression: ts.Expression): ts.Expression[] {
if (ts.isAwaitExpression(expression) || ts.isParenthesizedExpression(expression)) {
			return [expression.expression];
		}
if (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)) {
			return [expression.expression];
		}
		if (ts.isTypeAssertionExpression(expression)) {
			return [expression.expression];
		}
		return [];
	}

	/** Responsibilities: _resolution owner represented output_. **/
	public reference_owner(type: ts.TypeNode): string {
		const reference = new this.reference_type(type);
		const owner = reference.return_owner();
		if (owner.length > 0) {
			return owner;
		}
		return '';
	}

	/** Responsibilities: _unwrap nested output expressions_. **/
	public unwrap_expression(expression: ts.Expression): ts.Expression[] {
		let current = expression;
		while (true) {
			const next = this.wrapped_expression(current);
			if (next.length === 0) {
				return [current];
			}
			const unwrapped = next[0];
			current = unwrapped;
		}
	}

}
