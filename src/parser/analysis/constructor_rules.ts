import type { ConstructorRulesContract } from "src/parser/analysis/protocols";
import ts from "typescript";

/** Responsibilities: _constructor statement classification_, _constructor expression classification_. **/
export class ConstructorRules implements ConstructorRulesContract {
	private readonly _basic_expression_kinds: Set<ts.SyntaxKind>;
	private readonly _literal_expression_kinds: Set<ts.SyntaxKind>;
	private readonly _statement_results: WeakMap<ts.Statement, boolean>;
	private readonly _expression_results: WeakMap<ts.Expression, boolean>;

	/** Responsibilities: _classification variable declaration allowed_. **/
	private constructor_variable_allowed(statement: ts.VariableStatement): boolean {
		return statement.declarationList.declarations.every((item) => {
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

	/** Responsibilities: _assignment classification_. **/
	private constructor_assignment_allowed(expression: ts.BinaryExpression): boolean {
		if (expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			if (!this.expression_allowed(expression.left)) {
				return false;
			}
			return this.expression_allowed(expression.right);
		}
		if (!ts.isPropertyAccessExpression(expression.left) && !ts.isElementAccessExpression(expression.left)) {
			return true;
		}
		return this.expression_allowed(expression.right);
	}

	/** Responsibilities: _constructor statement classification_. **/
	private evaluate_statement(statement: ts.Statement): boolean {
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
		if (ts.isVariableStatement(statement)) {
			return this.constructor_variable_allowed(statement);
		}
		return false;
	}

	/** Responsibilities: _constructor expression classification_. **/
	private evaluate_expression(expression: ts.Expression): boolean {
		if (this._basic_expression_kinds.has(expression.kind)) {
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

	/** Responsibilities: _transparent initializer resolution_. **/
	private unwrap_initializer(initializer_expression: ts.Expression): ts.Expression {
		if (ts.isParenthesizedExpression(initializer_expression)) {
			return initializer_expression.expression;
		}
		if (ts.isAsExpression(initializer_expression)) {
			return initializer_expression.expression;
		}
		if (ts.isTypeAssertionExpression(initializer_expression)) {
			return initializer_expression.expression;
		}
		if (ts.isSatisfiesExpression(initializer_expression)) {
			return initializer_expression.expression;
		}
		return initializer_expression;
	}

	/** Responsibilities: _literal initializer classification_. **/
	private literal_initializer(literal_candidate: ts.Expression): boolean {
		if (ts.isStringLiteralLike(literal_candidate) || ts.isNumericLiteral(literal_candidate)) {
			return true;
		}
		return this._literal_expression_kinds.has(literal_candidate.kind);
	}

	/** Responsibilities: _signed numeric initializer classification_. **/
	private signed_numeric_initializer(prefix: ts.PrefixUnaryExpression): boolean {
		if (prefix.operator !== ts.SyntaxKind.MinusToken && prefix.operator !== ts.SyntaxKind.PlusToken) {
			return false;
		}
		return ts.isNumericLiteral(prefix.operand);
	}

	/** Responsibilities: _allowed initializer classification_. **/
	private simple_initializer(initializer: ts.Expression): boolean {
		if (this.literal_initializer(initializer)) {
			return true;
		}
		if (!ts.isPrefixUnaryExpression(initializer)) {
			return false;
		}
		return this.signed_numeric_initializer(initializer);
	}

	/** Responsibilities: _constructor policy initialization_. **/
	public constructor() {
		this._basic_expression_kinds = new Set([
			ts.SyntaxKind.Identifier,
			ts.SyntaxKind.PropertyAccessExpression,
			ts.SyntaxKind.NewExpression,
		]);
		this._literal_expression_kinds = new Set([
			ts.SyntaxKind.TrueKeyword,
			ts.SyntaxKind.FalseKeyword,
			ts.SyntaxKind.NullKeyword,
		]);
		this._statement_results = new WeakMap<ts.Statement, boolean>();
		this._expression_results = new WeakMap<ts.Expression, boolean>();
	}

	/** Responsibilities: _reporting constructor statement_. **/
	public statement_allowed(statement: ts.Statement): boolean {
		const cached = this._statement_results.get(statement);
		if (cached !== undefined) {
			return cached;
		}
		const result = this.evaluate_statement(statement);
		this._statement_results.set(statement, result);
		return result;
	}

	/** Responsibilities: _reporting constructor expression satisfies_. **/
	public expression_allowed(expression: ts.Expression): boolean {
		const cached = this._expression_results.get(expression);
		if (cached !== undefined) {
			return cached;
		}
		const result = this.evaluate_expression(expression);
		this._expression_results.set(expression, result);
		return result;
	}

	/** Responsibilities: _field initializer policy_. **/
	public field_initializer_allowed(node: ts.PropertyDeclaration): boolean {
		let initializer = node.initializer;
		if (initializer === undefined) {
			return true;
		}
		while (true) {
			const unwrapped = this.unwrap_initializer(initializer);
			if (unwrapped === initializer) {
				break;
			}
			initializer = unwrapped;
		}
		return this.simple_initializer(initializer);
	}
}
