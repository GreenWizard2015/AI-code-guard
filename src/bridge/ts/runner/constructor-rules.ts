import ts from 'typescript';

/** Responsibilities: _classification allowed TypeScript constructor_. **/
export class ConstructorRules {
	private readonly basic_expression_kinds = new Set([
		ts.SyntaxKind.Identifier,
		ts.SyntaxKind.PropertyAccessExpression,
		ts.SyntaxKind.NewExpression,
	]);

	/** Responsibilities: _classification variable declaration allowed_. **/
	private constructor_variable_allowed(statement: ts.Statement): boolean {
		if (!ts.isVariableStatement(statement)) {
			return false;
		}
		return statement.declarationList.declarations.every(item => {
			if (item.initializer === undefined) {
				return true;
			}
			return this.expression_allowed(item.initializer);
		});
	}

	/** Responsibilities: _classification statements constructor block_. **/
	private constructor_block_allowed(statement: ts.Block): boolean {
		for (const item of statement.statements) {
			if (!this.statement_allowed(item)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _classification constructor conditional contains_. **/
	private constructor_if_allowed(statement: ts.IfStatement): boolean {
		if (!this.statement_allowed(statement.thenStatement)) {
			return false;
		}
		if (statement.elseStatement) {
			return this.statement_allowed(statement.elseStatement);
		}
		return true;
	}

	/** Responsibilities: _classification constructor invocation permitted_. **/
	private constructor_call_allowed(expression: ts.CallExpression): boolean {
		if (ts.isIdentifier(expression.expression)) {
			return true;
		}
		if (expression.expression.kind === ts.SyntaxKind.SuperKeyword) {
			return true;
		}
		if (!ts.isPropertyAccessExpression(expression.expression)) {
			return false;
		}
		return expression.expression.expression.kind !== ts.SyntaxKind.ThisKeyword;
	}

	/** Responsibilities: _assignment classification _. **/
	private constructor_assignment_allowed(expression: ts.BinaryExpression): boolean {
		if (expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return true;
		}
		if (!ts.isPropertyAccessExpression(expression.left)) {
			return true;
		}
		return this.expression_allowed(expression.right);
	}

	/** Responsibilities: _reporting constructor statement satisfies_. **/
	public statement_allowed(statement: ts.Statement): boolean {
		if (ts.isBlock(statement)) {
			return this.constructor_block_allowed(statement);
		}
		if (ts.isThrowStatement(statement)) {
			return true;
		}
		if (ts.isIfStatement(statement)) {
			return this.constructor_if_allowed(statement);
		}
		if (ts.isExpressionStatement(statement)) {
			return this.expression_allowed(statement.expression);
		}
		return this.constructor_variable_allowed(statement);
	}

	/** Responsibilities: _reporting constructor expression satisfies_. **/
	public expression_allowed(expression: ts.Expression): boolean {
		if (this.basic_expression_kinds.has(expression.kind)) {
			return true;
		}
		if (ts.isCallExpression(expression)) {
			return this.constructor_call_allowed(expression);
		}
		if (ts.isBinaryExpression(expression)) {
			return this.constructor_assignment_allowed(expression);
		}
		return true;
	}
}
