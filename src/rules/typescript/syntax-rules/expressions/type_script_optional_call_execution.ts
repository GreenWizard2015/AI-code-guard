import type { BooleanExpressionContract } from "src/runtime_protocols";
import ts from "typescript";

/** Responsibilities: _optional call classification_, _optional member call classification_. **/
export class TypeScriptOptionalCallExecution {
	private readonly _boolean_expression: BooleanExpressionContract;

	/** Responsibilities: _conditional call classification_. **/
	public constructor(boolean_expression: BooleanExpressionContract) {
		this._boolean_expression = boolean_expression;
	}

	/** Responsibilities: _optional member call classification_. **/
	public optional_member_call(member_access: ts.Node, source_file: ts.SourceFile): boolean {
		if (!ts.isPropertyAccessExpression(member_access) && !ts.isElementAccessExpression(member_access)) {
			return false;
		}
		if (member_access.questionDotToken === undefined) {
			return false;
		}
		const call = member_access.parent;
		if (!ts.isCallExpression(call) || call.expression !== member_access) {
			return false;
		}
		return !this._boolean_expression.boolean_call(call, source_file);
	}

	/** Responsibilities: _optional call classification_. **/
	public optional_call(call_expression: ts.CallExpression, source_file: ts.SourceFile): boolean {
		if (call_expression.questionDotToken === undefined) {
			return false;
		}
		return !this._boolean_expression.boolean_call(call_expression, source_file);
	}
}
