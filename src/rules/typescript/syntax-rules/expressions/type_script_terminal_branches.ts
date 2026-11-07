import type { TypeScriptTerminalBranchesContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _terminal statement analysis_, _early exit branch classification_. **/
export class TypeScriptTerminalBranches implements TypeScriptTerminalBranchesContract {
	private readonly _terminal_statement_kinds: ReadonlySet<ts.SyntaxKind>;

	/** Responsibilities: _terminal loop classification_. **/
	private terminal_loop(loop_candidate: ts.Statement): boolean {
		if (ts.isWhileStatement(loop_candidate)) {
			if (loop_candidate.expression.kind !== ts.SyntaxKind.TrueKeyword) {
				return false;
			}
			return this.terminal_statement(loop_candidate.statement);
		}
		if (ts.isDoStatement(loop_candidate)) {
			return this.terminal_statement(loop_candidate.statement);
		}
		if (!ts.isForStatement(loop_candidate)) {
			return false;
		}
		if (loop_candidate.condition !== undefined) {
			return false;
		}
		return this.terminal_statement(loop_candidate.statement);
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
		if (this._terminal_statement_kinds.has(child.kind)) {
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
	private terminal_fallthrough(if_candidate: ts.Statement): boolean {
		if (!ts.isIfStatement(if_candidate)) {
			return false;
		}
		if (if_candidate.elseStatement !== undefined) {
			return false;
		}
		return this.terminal_statement(if_candidate.thenStatement);
	}

	/** Responsibilities: _terminal block classification_. **/
	private terminal_block(statement: ts.Block): boolean {
		if (statement.statements.length === 0) {
			return false;
		}
		const last_statement = statement.statements.at(-1);
		if (last_statement === undefined || !this.terminal_child(last_statement)) {
			return false;
		}
		for (const current of statement.statements.slice(0, -1)) {
			if (!this.terminal_fallthrough(current)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _terminal statement policy ownership_. **/
	public constructor(terminal_statement_kinds: ReadonlySet<ts.SyntaxKind>) {
		this._terminal_statement_kinds = terminal_statement_kinds;
	}
	/** Responsibilities: _public operation_. **/
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
