import ts from 'typescript';

/** Responsibilities: _classification terminal TypeScript branches_. **/
export class TypeScriptTerminalBranches {
	private readonly terminal_statement_kinds = new Set([ts.SyntaxKind.ReturnStatement]);

	/** Responsibilities: _terminal loop classification_. **/
	private terminal_loop(statement: ts.Statement): boolean {
		if (ts.isWhileStatement(statement)) {
			if (statement.expression.kind !== ts.SyntaxKind.TrueKeyword) {
				return false;
			}
			return this.terminal_statement(statement.statement);
		}
		if (ts.isDoStatement(statement)) {
			return this.terminal_statement(statement.statement);
		}
		if (!ts.isForStatement(statement)) {
			return false;
		}
		if (statement.condition !== undefined) {
			return false;
		}
		return this.terminal_statement(statement.statement);
	}

	/** Responsibilities: _terminal try classification_. **/
	private terminal_try(statement: ts.TryStatement): boolean {
		if (!this.terminal_statement(statement.tryBlock)) {
			return false;
		}
		if (statement.catchClause === undefined) {
			return true;
		}
		return this.terminal_statement(statement.catchClause.block);
	}

	/** Responsibilities: _terminal conditional classification_. **/
	private terminal_if(statement: ts.IfStatement): boolean {
		if (statement.elseStatement === undefined) {
			return false;
		}
		if (!this.terminal_statement(statement.thenStatement)) {
			return false;
		}
		return this.terminal_statement(statement.elseStatement);
	}

	/** Responsibilities: _terminal child classification_. **/
	private terminal_child(child: ts.Statement): boolean {
		if (this.terminal_statement_kinds.has(child.kind)) {
			return true;
		}
		if (ts.isIfStatement(child)) {
			return this.terminal_if(child);
		}
		if (ts.isIterationStatement(child, true)) {
			return this.terminal_loop(child);
		}
		if (ts.isTryStatement(child)) {
			return this.terminal_try(child);
		}
		return false;
	}

	/** Responsibilities: _terminal fallthrough classification_. **/
	private terminal_fallthrough(statement: ts.Statement): boolean {
		if (!ts.isIfStatement(statement)) {
			return false;
		}
		if (statement.elseStatement !== undefined) {
			return false;
		}
		return this.terminal_statement(statement.thenStatement);
	}

	/** Responsibilities: _terminal block classification_. **/
	private terminal_block(statement: ts.Block): boolean {
		if (statement.statements.length === 0) {
			return false;
		}
		if (statement.statements.length === 1) {
			return this.terminal_child(statement.statements[0]);
		}
		const last_statement = statement.statements[statement.statements.length - 1];
		if (!this.terminal_child(last_statement)) {
			return false;
		}
		for (const current of statement.statements.slice(0, -1)) {
			if (!this.terminal_fallthrough(current)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _terminal statement classification_. **/
	public terminal_statement(statement: ts.Statement): boolean {
		if (!ts.isBlock(statement)) {
			return false;
		}
		return this.terminal_block(statement);
	}

	/** Responsibilities: _early exit branch_. **/
	public early_exit(node: ts.IfStatement): boolean {
		if (node.elseStatement === undefined) {
			return false;
		}
		if (!this.terminal_statement(node.thenStatement)) {
			return false;
		}
		return this.terminal_statement(node.elseStatement);
	}
}
