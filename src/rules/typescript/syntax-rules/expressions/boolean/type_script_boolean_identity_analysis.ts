import { EQUALITY_COMPARISON_OPERATOR_KINDS } from "src/parser/internals/constants";
import ts from "typescript";

/** Responsibilities: _boolean identity classification_, _identity return analysis_. **/
export class TypeScriptBooleanIdentityAnalysis {
	private readonly _return_results: WeakMap<ts.IfStatement, boolean>;
	private readonly _repeated_branch_results: WeakMap<ts.IfStatement, boolean>;

	/** Responsibilities: _single return statement shape_. **/
	private single_return_statement(branch_statement: ts.Statement): boolean {
		let statement: ts.Statement = branch_statement;
		if (!ts.isBlock(statement)) {
			return ts.isReturnStatement(statement);
		}
		if (statement.statements.length !== 1) {
			return false;
		}
		const returned_statement = statement.statements.at(0);
		if (returned_statement === undefined) {
			return false;
		}
		statement = returned_statement;
		return ts.isReturnStatement(statement);
	}

	/** Responsibilities: _equality branch identifier lookup_. **/
	private comparison_identifier(expression: ts.Expression): string {
		if (!ts.isBinaryExpression(expression)) {
			return "";
		}
		if (!EQUALITY_COMPARISON_OPERATOR_KINDS.includes(expression.operatorToken.kind)) {
			return "";
		}
		if (!ts.isIdentifier(expression.left)) {
			return "";
		}
		return expression.left.text;
	}

	/** Responsibilities: _repeated comparison branch tail_. **/
	private repeated_comparison_tail(branch_root: ts.IfStatement, comparison_name: string): boolean {
		let found_repeat = false;
		let alternative: ts.Statement | undefined = branch_root.elseStatement;
		while (alternative !== undefined && ts.isIfStatement(alternative)) {
			const current_name = this.comparison_identifier(alternative.expression);
			if (current_name.length === 0) {
				break;
			}
			if (current_name !== comparison_name) {
				return false;
			}
			found_repeat = true;
			alternative = alternative.elseStatement;
		}
		return found_repeat;
	}

	/** Responsibilities: _repeated identifier branch chain_. **/
	private repeated_branch_chain(branch_root: ts.IfStatement): boolean {
		const comparison_name = this.comparison_identifier(branch_root.expression);
		if (comparison_name.length === 0) {
			return false;
		}
		return this.repeated_comparison_tail(branch_root, comparison_name);
	}

	/** Responsibilities: _boolean identity analysis initialization_. **/
	public constructor() {
		this._return_results = new WeakMap<ts.IfStatement, boolean>();
		this._repeated_branch_results = new WeakMap<ts.IfStatement, boolean>();
	}

	/** Responsibilities: _boolean identity expression classification_. **/
	public identity_expression(candidate_expression: ts.Expression): boolean {
		if (!ts.isBinaryExpression(candidate_expression)) {
			return false;
		}
		const operator = candidate_expression.operatorToken.kind;
		if (!EQUALITY_COMPARISON_OPERATOR_KINDS.includes(operator)) {
			return false;
		}
		const left_boolean =
			candidate_expression.left.kind === ts.SyntaxKind.TrueKeyword ||
			candidate_expression.left.kind === ts.SyntaxKind.FalseKeyword;
		const right_boolean =
			candidate_expression.right.kind === ts.SyntaxKind.TrueKeyword ||
			candidate_expression.right.kind === ts.SyntaxKind.FalseKeyword;
		return left_boolean !== right_boolean;
	}

	/** Responsibilities: _boolean identity return classification_. **/
	public identity_return(branch_node: ts.IfStatement): boolean {
		const cached = this._return_results.get(branch_node);
		if (cached !== undefined) {
			return cached;
		}
		if (branch_node.elseStatement !== undefined) {
			return false;
		}
		if (!this.single_return_statement(branch_node.thenStatement)) {
			return false;
		}
		const result = this.identity_expression(branch_node.expression);
		this._return_results.set(branch_node, result);
		return result;
	}

	/** Responsibilities: _repeated identifier branch analysis_. **/
	public repeated_branch(branch_node: ts.IfStatement): boolean {
		const cached = this._repeated_branch_results.get(branch_node);
		if (cached !== undefined) {
			return cached;
		}
		const result = this.repeated_branch_chain(branch_node);
		this._repeated_branch_results.set(branch_node, result);
		return result;
	}
}
