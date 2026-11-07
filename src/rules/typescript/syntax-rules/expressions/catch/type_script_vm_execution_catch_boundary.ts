import { VM_RUN_IN_CONTEXT_NAME } from "src/parser/internals/constants";
import ts from "typescript";

/** Responsibilities: _VM runtime boundary_, _failure result conversion_. **/
export class TypeScriptVmExecutionCatchBoundary {
	private readonly _clause: ts.CatchClause;
	private readonly _handler: ts.Block;

	/** Responsibilities: _VM import binding classification_. **/
	private is_vm_import(import_statement: ts.Statement): boolean {
		if (!ts.isImportDeclaration(import_statement) || !ts.isStringLiteral(import_statement.moduleSpecifier)) {
			return false;
		}
		if (import_statement.moduleSpecifier.text !== "node:vm" || import_statement.importClause === undefined) {
			return false;
		}
		const bindings = import_statement.importClause.namedBindings;
		if (bindings === undefined || !ts.isNamedImports(bindings)) {
			return false;
		}
		return bindings.elements.some((element) => element.name.text === VM_RUN_IN_CONTEXT_NAME);
	}

	/** Responsibilities: _caught error conversion_. **/
	private is_caught_error(expression: ts.Expression): boolean {
		const binding = this._clause.variableDeclaration;
		if (binding === undefined) {
			return false;
		}
		if (!ts.isIdentifier(binding.name)) {
			return false;
		}
		return ts.isIdentifier(expression) && expression.text === binding.name.text;
	}

	/** Responsibilities: _caught error string conversion_. **/
	private stringifies_caught_error(expression: ts.Expression): boolean {
		if (!ts.isCallExpression(expression) || !ts.isIdentifier(expression.expression)) {
			return false;
		}
		if (expression.expression.text !== "String" || expression.arguments.length !== 1) {
			return false;
		}
		for (const argument of expression.arguments) {
			return this.is_caught_error(argument);
		}
		return false;
	}

	/** Responsibilities: _VM error assignment classification_. **/
	private is_stored_failure(failure_statement: ts.Statement): boolean {
		if (!ts.isExpressionStatement(failure_statement) || !ts.isBinaryExpression(failure_statement.expression)) {
			return false;
		}
		const assignment = failure_statement.expression;
		if (assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(assignment.left)) {
			return false;
		}
		if (assignment.left.expression.kind !== ts.SyntaxKind.ThisKeyword) {
			return false;
		}
		return this.stringifies_caught_error(assignment.right);
	}

	/** Responsibilities: _completed VM failure classification_. **/
	private is_done_property(property: ts.ObjectLiteralElementLike): boolean {
		if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
			return false;
		}
		return property.name.text === "done" && property.initializer.kind === ts.SyntaxKind.TrueKeyword;
	}

	/** Responsibilities: _VM error result classification_. **/
	private is_error_property(property: ts.ObjectLiteralElementLike): boolean {
		if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
			return false;
		}
		if (property.name.text !== "error") {
			return false;
		}
		return this.stringifies_caught_error(property.initializer);
	}

	/** Responsibilities: _VM result field classification_. **/
	private has_failure_fields(result: ts.ObjectLiteralExpression): boolean {
		let has_done = false;
		let has_error = false;
		for (const property of result.properties) {
			if (this.is_done_property(property)) {
				has_done = true;
			}
			if (this.is_error_property(property)) {
				has_error = true;
			}
		}
		return has_done && has_error;
	}

	/** Responsibilities: _VM failure response classification_. **/
	private is_failure_response(return_statement: ts.Statement): boolean {
		if (!ts.isReturnStatement(return_statement) || return_statement.expression === undefined) {
			return false;
		}
		if (this.stringifies_caught_error(return_statement.expression)) {
			return true;
		}
		if (!ts.isObjectLiteralExpression(return_statement.expression)) {
			return false;
		}
		return this.has_failure_fields(return_statement.expression);
	}

	/** Responsibilities: _VM call classification_. **/
	private vm_call_statement(statement: ts.Statement): boolean {
		if (!ts.isExpressionStatement(statement)) {
			return false;
		}
		let call = statement.expression;
		if (ts.isBinaryExpression(call) && call.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
			call = call.right;
		}
		if (!ts.isCallExpression(call)) {
			return false;
		}
		return ts.isIdentifier(call.expression) && call.expression.text === VM_RUN_IN_CONTEXT_NAME;
	}

	/** Responsibilities: _VM catch state_. **/
	public constructor(clause: ts.CatchClause) {
		this._clause = clause;
		this._handler = clause.block;
	}

	/** Responsibilities: _VM runtime import lookup_. **/
	public imports_vm_runtime(): boolean {
		for (const statement of this._clause.getSourceFile().statements) {
			if (this.is_vm_import(statement)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _VM call classification_. **/
	public vm_call(): boolean {
		const parent = this._clause.parent;
		if (!ts.isTryStatement(parent) || parent.tryBlock.statements.length !== 1) {
			return false;
		}
		for (const statement of parent.tryBlock.statements) {
			return this.vm_call_statement(statement);
		}
		return false;
	}

	/** Responsibilities: _VM error storage classification_. **/
	public stores_failure(): boolean {
		if (this._handler.statements.length !== 1) {
			return false;
		}
		for (const statement of this._handler.statements) {
			return this.is_stored_failure(statement);
		}
		return false;
	}

	/** Responsibilities: _VM failure result classification_. **/
	public returns_failure(): boolean {
		if (this._handler.statements.length !== 1) {
			return false;
		}
		for (const statement of this._handler.statements) {
			return this.is_failure_response(statement);
		}
		return false;
	}
}
