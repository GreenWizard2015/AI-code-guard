import ts from "typescript";

/** Responsibilities: _caught error binding_, _broad catch classification_. **/
export class TypeScriptCatchClause {
	private readonly _clause: ts.CatchClause;
	private readonly _statements: ts.NodeArray<ts.Statement>;

	/** Responsibilities: _caught error identifier_. **/
	private caught_error_name(): string {
		const variable = this._clause.variableDeclaration;
		if (variable === undefined) {
			return "";
		}
		if (!ts.isIdentifier(variable.name)) {
			return "";
		}
		return variable.name.getText();
	}

	/** Responsibilities: _caught error identity_. **/
	private error_is_preserved(error_value: ts.Expression): boolean {
		if (ts.isIdentifier(error_value)) {
			return error_value.text === this.caught_error_name();
		}
		if (!ts.isNewExpression(error_value) || error_value.arguments === undefined) {
			return false;
		}
		return error_value.arguments.some((argument) => this.cause_argument(argument));
	}

	/** Responsibilities: _error cause argument classification_. **/
	private cause_argument(argument: ts.Expression): boolean {
		if (!ts.isObjectLiteralExpression(argument)) {
			return false;
		}
		return argument.properties.some((property) => this.cause_property(property));
	}

	/** Responsibilities: _error cause property classification_. **/
	private cause_property(property: ts.ObjectLiteralElementLike): boolean {
		if (!ts.isPropertyAssignment(property)) {
			return false;
		}
		if (!ts.isIdentifier(property.name) || property.name.text !== "cause") {
			return false;
		}
		if (!ts.isIdentifier(property.initializer)) {
			return false;
		}
		return property.initializer.text === this.caught_error_name();
	}

	/** Responsibilities: _unconditional caught error throw_. **/
	private preserves_error(statement: ts.Statement): boolean {
		if (ts.isThrowStatement(statement) && statement.expression !== undefined) {
			return this.error_is_preserved(statement.expression);
		}
		if (ts.isTryStatement(statement) && statement.finallyBlock !== undefined) {
			return this.preserves_error(statement.finallyBlock);
		}
		if (ts.isBlock(statement)) {
			const final_statement = statement.statements.at(-1);
			if (final_statement === undefined) {
				return false;
			}
			return this.preserves_error(final_statement);
		}
		return false;
	}

	/** Responsibilities: _specific error branch preservation_. **/
	private guard_preserves_error(
		conditional: ts.IfStatement,
		condition: ts.Expression,
		preserve_when_true: boolean,
	): boolean {
		if (ts.isCallExpression(condition)) {
			return this.call_guard_throws(conditional, condition, preserve_when_true);
		}
		if (!ts.isBinaryExpression(condition) || condition.operatorToken.kind !== ts.SyntaxKind.InstanceOfKeyword) {
			return false;
		}
		if (!ts.isIdentifier(condition.left) || condition.left.text !== this.caught_error_name()) {
			return false;
		}
		if (preserve_when_true) {
			return this.preserves_error(conditional.thenStatement);
		}
		const unmatched_branch = conditional.elseStatement;
		if (unmatched_branch === undefined) {
			return false;
		}
		return this.preserves_error(unmatched_branch);
	}

	/** Responsibilities: _guarded exception flow_. **/
	private call_guard_throws(
		conditional: ts.IfStatement,
		guard_call: ts.CallExpression,
		preserve_when_true: boolean,
	): boolean {
		const references_error = guard_call.arguments.some((argument) => this.references_error(argument));
		if (!references_error) {
			return false;
		}
		if (preserve_when_true) {
			return this.preserves_error(conditional.thenStatement);
		}
		const unmatched_branch = conditional.elseStatement;
		if (unmatched_branch === undefined) {
			return false;
		}
		return this.preserves_error(unmatched_branch);
	}

	/** Responsibilities: _caught error reference matching_. **/
	private references_error(reference: ts.Expression): boolean {
		if (ts.isIdentifier(reference)) {
			return reference.text === this.caught_error_name();
		}
		if (!ts.isCallExpression(reference) || !ts.isIdentifier(reference.expression)) {
			return false;
		}
		const string_conversion = reference.expression.text === "String";
		const references_caught_error = reference.arguments.some(
			(argument) => ts.isIdentifier(argument) && argument.text === this.caught_error_name(),
		);
		return string_conversion && references_caught_error;
	}

	/** Responsibilities: _recovery delegation_. **/
	private delegates_recovery(recovery_statement: ts.ExpressionStatement): boolean {
		if (!ts.isCallExpression(recovery_statement.expression)) {
			return false;
		}
		const expression = recovery_statement.expression.expression;
		if (!ts.isPropertyAccessExpression(expression) || expression.name.text !== "restore_failure") {
			return false;
		}
		return recovery_statement.expression.arguments.some((argument) => this.references_error(argument));
	}

	/** Responsibilities: _catch recovery classification_. **/
	private handles_catch_branch(statement: ts.Statement): boolean {
		if (ts.isIfStatement(statement)) {
			const condition = statement.expression;
			if (ts.isPrefixUnaryExpression(condition) && condition.operator === ts.SyntaxKind.ExclamationToken) {
				return this.guard_preserves_error(statement, condition.operand, true);
			}
			return this.guard_preserves_error(statement, condition, false);
		}
		if (ts.isExpressionStatement(statement)) {
			return this.delegates_recovery(statement);
		}
		return false;
	}

	/** Responsibilities: _bound error classification_. **/
	private reports_bound_catch(): boolean {
		if (this._statements.some((statement) => this.handles_catch_branch(statement))) {
			return false;
		}
		const final_statement = this._statements.at(-1);
		if (final_statement === undefined || this.preserves_error(final_statement)) {
			return false;
		}
		if (!ts.isIfStatement(final_statement)) {
			return true;
		}
		const condition = final_statement.expression;
		if (ts.isPrefixUnaryExpression(condition) && condition.operator === ts.SyntaxKind.ExclamationToken) {
			return !this.guard_preserves_error(final_statement, condition.operand, true);
		}
		return !this.guard_preserves_error(final_statement, condition, false);
	}

	/** Responsibilities: _catch clause initialization_. **/
	public constructor(clause: ts.CatchClause) {
		this._clause = clause;
		this._statements = clause.block.statements;
	}

	/** Responsibilities: _named error binding_. **/
	public error_binding_named(): boolean {
		const variable = this._clause.variableDeclaration;
		return variable !== undefined && ts.isIdentifier(variable.name);
	}

	/** Responsibilities: _broad catch diagnosis_. **/
	public reports_broad_catch(): boolean {
		if (!this.error_binding_named()) {
			return true;
		}
		const variable = this._clause.variableDeclaration;
		if (variable === undefined) {
			return true;
		}
		return this.reports_bound_catch();
	}
}
