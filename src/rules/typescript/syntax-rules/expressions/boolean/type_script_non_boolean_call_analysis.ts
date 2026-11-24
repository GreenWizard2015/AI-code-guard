import type { BooleanExpressionContract } from "src/runtime_protocols";
import ts from "typescript";

/** Responsibilities: _non-boolean call analysis_, _conditional result caching_. **/
export class TypeScriptNonBooleanCallAnalysis {
	private readonly _boolean_expression: BooleanExpressionContract;
	private readonly _non_boolean_calls: WeakMap<ts.Node, boolean>;
	private readonly _conditional_results: WeakMap<ts.Node, boolean>;

	/** Responsibilities: _non-boolean analysis setup_. **/
	public constructor(boolean_expression: BooleanExpressionContract) {
		this._boolean_expression = boolean_expression;
		this._non_boolean_calls = new WeakMap();
		this._conditional_results = new WeakMap();
	}

	/** Responsibilities: _nested non-boolean call detection_. **/
	public detects_nonboolean_call(expression_node: ts.Node, boolean_source_file: ts.SourceFile): boolean {
		const cached = this._non_boolean_calls.get(expression_node);
		if (cached !== undefined) {
			return cached;
		}
		let result = false;
		if (ts.isCallExpression(expression_node)) {
			result = !this._boolean_expression.boolean_call(expression_node, boolean_source_file);
		}
		if (!result) {
			expression_node.forEachChild((child) => {
				if (!result) {
					result = this.detects_nonboolean_call(child, boolean_source_file);
				}
			});
		}
		this._non_boolean_calls.set(expression_node, result);
		return result;
	}

	/** Responsibilities: _non-boolean logical result_. **/
	public contains_non_boolean(expression_node: ts.Node, boolean_source_file: ts.SourceFile): boolean {
		const cached = this._conditional_results.get(expression_node);
		if (cached !== undefined) {
			return cached;
		}
		let result = false;
		if (ts.isBinaryExpression(expression_node)) {
			if (this._boolean_expression.logical_operator(expression_node)) {
				result = this.contains_non_boolean(expression_node.right, boolean_source_file);
			} else {
				result = this.detects_nonboolean_call(expression_node, boolean_source_file);
			}
		} else {
			result = this.detects_nonboolean_call(expression_node, boolean_source_file);
		}
		this._conditional_results.set(expression_node, result);
		return result;
	}
}
