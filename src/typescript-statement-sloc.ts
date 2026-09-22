import ts from 'typescript';

/** Responsibilities: _calculation TypeScript statement complexity_. **/
export class TypeScriptStatementSloc {
	private readonly statement_cost = 1;

	/** Responsibilities: _statement SLOC aggregation_. **/
	private statement_list_sloc(statements: readonly ts.Statement[]): number {
		let count = 0;
		for (const child of statements) {
			count += this.statement_sloc(child);
		}
		return count;
	}

	/** Responsibilities: _conditional SLOC calculation_. **/
	private conditional_sloc(statement: ts.IfStatement): number {
		let else_sloc = 0;
		if (statement.elseStatement) {
			else_sloc = this.statement_sloc(statement.elseStatement);
		}
		return this.statement_cost + this.statement_sloc(statement.thenStatement) + else_sloc;
	}

	/** Responsibilities: _calculation SLOC switch statement_. **/
	private switch_sloc(statement: ts.SwitchStatement): number {
		let count = this.statement_cost;
		for (const clause of statement.caseBlock.clauses) {
			count += this.statement_list_sloc(clause.statements);
		}
		return count;
	}

	/** Responsibilities: _calculation SLOC try catch_. **/
	private try_sloc(statement: ts.TryStatement): number {
		let catch_sloc = 0;
		if (statement.catchClause) {
			catch_sloc = this.statement_list_sloc(statement.catchClause.block.statements);
		}
		let finally_sloc = 0;
		if (statement.finallyBlock) {
			finally_sloc = this.statement_list_sloc(statement.finallyBlock.statements);
		}
		return (
			this.statement_cost +
			this.statement_list_sloc(statement.tryBlock.statements) +
			catch_sloc +
			finally_sloc
		);
	}

	/** Responsibilities: _classification loop statements contribute_. **/
	private is_loop_statement(statement: ts.Statement): boolean {
		if (ts.isForStatement(statement) || ts.isForInStatement(statement) || ts.isForOfStatement(statement)) {
			return true;
		}
		if (ts.isWhileStatement(statement) || ts.isDoStatement(statement)) {
			return true;
		}
		return ts.isLabeledStatement(statement);
	}

	/** Responsibilities: _calculation SLOC loop statement_. **/
	private loop_sloc(statement: ts.Statement): number {
		if (ts.isForStatement(statement) || ts.isForInStatement(statement) || ts.isForOfStatement(statement)) {
			return this.statement_cost + this.statement_sloc(statement.statement);
		}
		if (ts.isWhileStatement(statement) || ts.isDoStatement(statement)) {
			return this.statement_cost + this.statement_sloc(statement.statement);
		}
		if (ts.isLabeledStatement(statement)) {
			return this.statement_cost + this.statement_sloc(statement.statement);
		}
		return this.statement_cost;
	}

	/** Responsibilities: _reporting statement compound_. **/
	public compound_statement(statement: ts.Statement): boolean {
		if (ts.isBlock(statement) || ts.isIfStatement(statement)) {
			return true;
		}
return ts.isSwitchStatement(statement) || ts.isTryStatement(statement);
	}

	/** Responsibilities: _calculation compound SLOC statement_. **/
	public compound_sloc(statement: ts.Statement): number {
		if (ts.isBlock(statement)) {
			return this.statement_list_sloc(statement.statements);
		}
		if (ts.isIfStatement(statement)) {
			return this.conditional_sloc(statement);
		}
		if (ts.isSwitchStatement(statement)) {
			return this.switch_sloc(statement);
		}
		if (ts.isTryStatement(statement)) {
			return this.try_sloc(statement);
		}
		return 0;
	}

	/** Responsibilities: _calculation significant SLOC statement_. **/
	public statement_sloc(statement: ts.Statement): number {
		if (this.compound_statement(statement)) {
			return this.compound_sloc(statement);
		}
		if (this.is_loop_statement(statement)) {
			return this.loop_sloc(statement);
		}
		return this.statement_cost;
	}
}
