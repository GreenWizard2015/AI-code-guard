import type {
	TypeScriptClassDecisionFieldIndex,
	TypeScriptClassDecisionFieldsContract,
} from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _decision fields_, _error context fields_. **/
export class TypeScriptClassDecisionFields implements TypeScriptClassDecisionFieldsContract {
	private readonly _declaration: ts.ClassLikeDeclaration;
	private readonly _decision_fields: Set<string>;
	private readonly _error_context_fields: Set<string>;

	/** Responsibilities: _comparison operators_. **/
	private boolean_operator(kind: ts.SyntaxKind): boolean {
		return [
			ts.SyntaxKind.EqualsEqualsToken,
			ts.SyntaxKind.EqualsEqualsEqualsToken,
			ts.SyntaxKind.ExclamationEqualsToken,
			ts.SyntaxKind.ExclamationEqualsEqualsToken,
			ts.SyntaxKind.GreaterThanToken,
			ts.SyntaxKind.GreaterThanEqualsToken,
			ts.SyntaxKind.LessThanToken,
			ts.SyntaxKind.LessThanEqualsToken,
			ts.SyntaxKind.InstanceOfKeyword,
			ts.SyntaxKind.InKeyword,
		].includes(kind);
	}

	/** Responsibilities: _decision statement conditions_. **/
	private decision_statement_expressions(node: ts.Node): ts.Node[] {
		if (ts.isIfStatement(node)) {
			return [node.expression];
		}
		if (ts.isWhileStatement(node)) {
			return [node.expression];
		}
		if (ts.isDoStatement(node)) {
			return [node.expression];
		}
		if (ts.isSwitchStatement(node)) {
			return [node.expression];
		}
		return [];
	}

	/** Responsibilities: _decision conditions_. **/
	private decision_expressions(node: ts.Node): ts.Node[] {
		const statement_expressions = this.decision_statement_expressions(node);
		if (statement_expressions.length > 0) {
			return statement_expressions;
		}
		if (ts.isConditionalExpression(node)) {
			return [node.condition];
		}
		if (ts.isForStatement(node) && node.condition !== undefined) {
			return [node.condition];
		}
		if (ts.isBinaryExpression(node) && this.boolean_operator(node.operatorToken.kind)) {
			return [node];
		}
		return [];
	}

	/** Responsibilities: _class field references_. **/
	private append_field_reads(root: ts.Node, target: Set<string>): void {
		const pending: ts.Node[] = [root];
		while (pending.length > 0) {
			const node = pending.pop();
			if (node === undefined) {
				continue;
			}
			if (ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword) {
				target.add(node.name.text);
			}
			ts.forEachChild(node, (child) => {
				pending.push(child);
			});
		}
	}

	/** Responsibilities: _decision field references_. **/
	private append_decision_reads(expressions: readonly ts.Node[]): void {
		for (const expression of expressions) {
			this.append_field_reads(expression, this._decision_fields);
		}
	}
	/** Responsibilities: _class declaration state_. **/
	public constructor(declaration: ts.ClassLikeDeclaration) {
		this._declaration = declaration;
		this._decision_fields = new Set();
		this._error_context_fields = new Set();
	}

	/** Responsibilities: _decision field index_. **/
	public collect(): TypeScriptClassDecisionFieldIndex {
		const pending: ts.Node[] = [this._declaration];
		while (pending.length > 0) {
			const node = pending.pop();
			if (node === undefined) {
				continue;
			}
			this.append_decision_reads(this.decision_expressions(node));
			if (ts.isThrowStatement(node)) {
				this.append_field_reads(node.expression, this._error_context_fields);
			}
			ts.forEachChild(node, (child) => {
				pending.push(child);
			});
		}
		return {
			decision_fields: this._decision_fields,
			error_context_fields: this._error_context_fields,
		};
	}
}
