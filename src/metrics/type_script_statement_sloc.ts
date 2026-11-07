import ts from "typescript";

/** Responsibilities: _statement complexity calculation_, _compound statement classification_. **/
export class TypeScriptStatementSloc {
	private readonly statement_cost = 1;
	private readonly _statement_sloc_cache: WeakMap<ts.Statement, number>;

	/** Responsibilities: _statement SLOC aggregation_. **/
	private statement_list_sloc(statements: readonly ts.Statement[]): number {
		let count = 0;
		for (const child of statements) {
			count += this.statement_sloc(child);
		}
		return count;
	}

	/** Responsibilities: _conditional SLOC calculation_. **/
	private conditional_sloc(conditional: ts.IfStatement): number {
		let else_sloc = 0;
		if (conditional.elseStatement) {
			else_sloc = this.statement_sloc(conditional.elseStatement);
		}
		return this.statement_cost + this.statement_sloc(conditional.thenStatement) + else_sloc;
	}

	/** Responsibilities: _calculation SLOC switch statement_. **/
	private switch_sloc(switch_statement: ts.SwitchStatement): number {
		let count = this.statement_cost;
		for (const clause of switch_statement.caseBlock.clauses) {
			count += this.statement_list_sloc(clause.statements);
		}
		return count;
	}

	/** Responsibilities: _calculation SLOC try catch_. **/
	private try_sloc(try_statement: ts.TryStatement): number {
		let catch_sloc = 0;
		if (try_statement.catchClause) {
			catch_sloc = this.statement_list_sloc(try_statement.catchClause.block.statements);
		}
		let finally_sloc = 0;
		if (try_statement.finallyBlock) {
			finally_sloc = this.statement_list_sloc(try_statement.finallyBlock.statements);
		}
		return (
			this.statement_cost + this.statement_list_sloc(try_statement.tryBlock.statements) + catch_sloc + finally_sloc
		);
	}

	/** Responsibilities: _classification loop statements contribute_. **/
	private is_loop_statement(candidate: ts.Statement): boolean {
		if (ts.isForStatement(candidate) || ts.isForInStatement(candidate) || ts.isForOfStatement(candidate)) {
			return true;
		}
		if (ts.isWhileStatement(candidate) || ts.isDoStatement(candidate)) {
			return true;
		}
		return ts.isLabeledStatement(candidate);
	}

	/** Responsibilities: _calculation SLOC loop statement_. **/
	private loop_sloc(loop: ts.Statement): number {
		if (ts.isForStatement(loop) || ts.isForInStatement(loop) || ts.isForOfStatement(loop)) {
			return this.statement_cost + this.statement_sloc(loop.statement);
		}
		if (ts.isWhileStatement(loop) || ts.isDoStatement(loop)) {
			return this.statement_cost + this.statement_sloc(loop.statement);
		}
		if (ts.isLabeledStatement(loop)) {
			return this.statement_cost + this.statement_sloc(loop.statement);
		}
		return this.statement_cost;
	}

	/** Responsibilities: _statement metric cache initialization_. **/
	public constructor() {
		this._statement_sloc_cache = new WeakMap();
	}

	/** Responsibilities: _reporting statement compound_. **/
	public compound_statement(candidate: ts.Statement): boolean {
		if (ts.isBlock(candidate) || ts.isIfStatement(candidate)) {
			return true;
		}
		return ts.isSwitchStatement(candidate) || ts.isTryStatement(candidate);
	}

	/** Responsibilities: _calculation compound SLOC statement_. **/
	public compound_sloc(compound: ts.Statement): number {
		if (ts.isBlock(compound)) {
			return this.statement_list_sloc(compound.statements);
		}
		if (ts.isIfStatement(compound)) {
			return this.conditional_sloc(compound);
		}
		if (ts.isSwitchStatement(compound)) {
			return this.switch_sloc(compound);
		}
		if (ts.isTryStatement(compound)) {
			return this.try_sloc(compound);
		}
		return 0;
	}

	/** Responsibilities: _calculation significant SLOC statement_. **/
	public statement_sloc(statement: ts.Statement): number {
		const cached = this._statement_sloc_cache.get(statement);
		if (cached !== undefined) {
			return cached;
		}
		let result = this.statement_cost;
		if (this.compound_statement(statement)) {
			result = this.compound_sloc(statement);
		} else if (this.is_loop_statement(statement)) {
			result = this.loop_sloc(statement);
		}
		this._statement_sloc_cache.set(statement, result);
		return result;
	}
}
