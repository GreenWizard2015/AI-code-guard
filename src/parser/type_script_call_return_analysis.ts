import { TypeScriptReferenceType } from "src/parser/analysis/type_script_reference_type";
import type { TypeScriptCallReturnAnalysisContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _invocation result expressions_, _reference owner resolution_. **/
export class TypeScriptCallReturnAnalysis implements TypeScriptCallReturnAnalysisContract {
	private readonly _reference_type: typeof TypeScriptReferenceType;
	private readonly _owner_cache: WeakMap<ts.TypeNode, string>;
	private readonly _expression_cache: WeakMap<ts.Expression, ts.Expression>;
	/** Responsibilities: _single output wrapper removal_. **/
	private unwrap_wrapper(wrapper: ts.Expression): ts.Expression {
		if (ts.isAwaitExpression(wrapper)) {
			return wrapper.expression;
		}
		if (ts.isParenthesizedExpression(wrapper)) {
			return wrapper.expression;
		}
		if (ts.isAsExpression(wrapper)) {
			return wrapper.expression;
		}
		if (ts.isSatisfiesExpression(wrapper)) {
			return wrapper.expression;
		}
		if (ts.isTypeAssertionExpression(wrapper)) {
			return wrapper.expression;
		}
		return wrapper;
	}

	/** Responsibilities: _AST reference cache initialization_. **/
	public constructor() {
		this._reference_type = TypeScriptReferenceType;
		this._owner_cache = new WeakMap();
		this._expression_cache = new WeakMap();
	}

	/** Responsibilities: _resolution owner represented output_. **/
	public reference_owner(type: ts.TypeNode): string {
		const cached = this._owner_cache.get(type);
		if (cached !== undefined) {
			return cached;
		}
		const reference = new this._reference_type(type);
		const owner = reference.return_owner();
		this._owner_cache.set(type, owner);
		return owner;
	}

	/** Responsibilities: _unwrap nested output expressions_. **/
	public unwrapped_expression(expression: ts.Expression): ts.Expression {
		const cached = this._expression_cache.get(expression);
		if (cached !== undefined) {
			return cached;
		}
		let current = expression;
		while (true) {
			const next = this.unwrap_wrapper(current);
			if (next === current) {
				this._expression_cache.set(expression, current);
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
