import ts from "typescript";

/** Responsibilities: _caught error binding_, _broad catch classification_. **/
export class TypeScriptCatchClause {
	private readonly clause: ts.CatchClause;
	private readonly statements: ts.NodeArray<ts.Statement>;

	/** Responsibilities: _caught error identity_. **/
	private error_is_preserved(expression: ts.Expression, name: string): boolean {
		if (ts.isIdentifier(expression)) {
			return expression.text === name;
		}
		if (!ts.isNewExpression(expression) || expression.arguments === undefined) {
			return false;
		}
		return expression.arguments.some((argument) => this.cause_argument(argument, name));
	}

	/** Responsibilities: _error cause argument classification_. **/
	private cause_argument(argument: ts.Expression, name: string): boolean {
		if (!ts.isObjectLiteralExpression(argument)) {
			return false;
		}
		return argument.properties.some((property) => this.cause_property(property, name));
	}

	/** Responsibilities: _error cause property classification_. **/
	private cause_property(property: ts.ObjectLiteralElementLike, name: string): boolean {
		if (!ts.isPropertyAssignment(property)) {
			return false;
		}
		if (!ts.isIdentifier(property.name) || property.name.text !== "cause") {
			return false;
		}
		if (!ts.isIdentifier(property.initializer)) {
			return false;
		}
		return property.initializer.text === name;
	}

	/** Responsibilities: _unconditional caught error throw_. **/
	private preserves_error(statement: ts.Statement, name: string): boolean {
		if (ts.isThrowStatement(statement) && statement.expression !== undefined) {
			return this.error_is_preserved(statement.expression, name);
		}
		if (ts.isBlock(statement)) {
			const final_statement = statement.statements.at(-1);
			if (final_statement === undefined) {
				return false;
			}
			return this.preserves_error(final_statement, name);
		}
		return false;
	}

	/** Responsibilities: _specific error branch preservation_. **/
	private unmatched_branch_throws(statement: ts.Statement, name: string): boolean {
		if (!ts.isIfStatement(statement)) {
			return false;
		}
		const expression = statement.expression;
		if (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.ExclamationToken) {
			return this.guard_branch_throws(statement, expression.operand, name, true);
		}
		return this.guard_branch_throws(statement, expression, name, false);
	}

	/** Responsibilities: _guard branch classification_. **/
	private guard_branch_throws(
		statement: ts.IfStatement,
		expression: ts.Expression,
		name: string,
		preserve_when_true: boolean,
	): boolean {
		if (ts.isCallExpression(expression)) {
			return this.call_guard_throws(statement, expression, name, preserve_when_true);
		}
		if (!ts.isBinaryExpression(expression) || expression.operatorToken.kind !== ts.SyntaxKind.InstanceOfKeyword) {
			return false;
		}
		if (!ts.isIdentifier(expression.left) || expression.left.text !== name) {
			return false;
		}
		return this.guard_branch_statement(statement, name, preserve_when_true);
	}

	/** Responsibilities: _guarded exception flow_. **/
	private call_guard_throws(
		statement: ts.IfStatement,
		expression: ts.CallExpression,
		name: string,
		preserve_when_true: boolean,
	): boolean {
		const references_error = expression.arguments.some((argument) => this.references_error(argument, name));
		if (!references_error) {
			return false;
		}
		return this.guard_branch_statement(statement, name, preserve_when_true);
	}

	/** Responsibilities: _guard branch selection_. **/
	private guard_branch_statement(statement: ts.IfStatement, name: string, preserve_when_true: boolean): boolean {
		if (preserve_when_true) {
			return this.preserves_error(statement.thenStatement, name);
		}
		const unmatched_branch = statement.elseStatement;
		if (unmatched_branch === undefined) {
			return false;
		}
		return this.preserves_error(unmatched_branch, name);
	}

	/** Responsibilities: _caught error reference matching_. **/
	private references_error(expression: ts.Expression, name: string): boolean {
		if (ts.isIdentifier(expression)) {
			return expression.text === name;
		}
		if (!ts.isCallExpression(expression) || !ts.isIdentifier(expression.expression)) {
			return false;
		}
		const string_conversion = expression.expression.text === "String";
		const references_caught_error = expression.arguments.some(
			(argument) => ts.isIdentifier(argument) && argument.text === name,
		);
		return string_conversion && references_caught_error;
	}

	/** Responsibilities: _recovery delegation_. **/
	private delegates_recovery(statement: ts.Statement, name: string): boolean {
		if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) {
			return false;
		}
		const expression = statement.expression.expression;
		if (!ts.isPropertyAccessExpression(expression) || expression.name.text !== "restore_failure") {
			return false;
		}
		return statement.expression.arguments.some((argument) => this.references_error(argument, name));
	}

	/** Responsibilities: _bound error classification_. **/
	private reports_bound_catch(name: string): boolean {
		if (
			this.statements.some(
				(statement) => this.unmatched_branch_throws(statement, name) || this.delegates_recovery(statement, name),
			)
		) {
			return false;
		}
		const final_statement = this.statements.at(-1);
		if (final_statement === undefined || this.preserves_error(final_statement, name)) {
			return false;
		}
		return !this.unmatched_branch_throws(final_statement, name);
	}

	/** Responsibilities: _catch clause initialization_. **/
	public constructor(clause: ts.CatchClause) {
		this.clause = clause;
		this.statements = clause.block.statements;
	}

	/** Responsibilities: _named error binding_. **/
	public error_binding_named(): boolean {
		const variable = this.clause.variableDeclaration;
		return variable !== undefined && ts.isIdentifier(variable.name);
	}

	/** Responsibilities: _broad catch diagnosis_. **/
	public reports_broad_catch(): boolean {
		if (!this.error_binding_named()) {
			return true;
		}
		const variable = this.clause.variableDeclaration;
		if (variable === undefined) {
			return true;
		}
		return this.reports_bound_catch(variable.name.getText());
	}
}
