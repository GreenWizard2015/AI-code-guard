import ts from "typescript";

/** Responsibilities: _JSON parser failure handling_, _fallback response contract_. **/
export class TypeScriptJsonParseCatchBoundary {
	private readonly _clause: ts.CatchClause;

	/** Responsibilities: _JSON parser call classification_. **/
	private is_parse_call(expression: ts.Expression): boolean {
		if (!ts.isCallExpression(expression)) {
			return false;
		}
		const target = expression.expression;
		if (!ts.isPropertyAccessExpression(target)) {
			return false;
		}
		if (!ts.isIdentifier(target.expression) || target.expression.text !== "JSON") {
			return false;
		}
		return target.name.text === "parse";
	}

	/** Responsibilities: _JSON parser statement classification_. **/
	private is_parse_statement(statement: ts.Statement): boolean {
		if (!ts.isReturnStatement(statement) || statement.expression === undefined) {
			return false;
		}
		return this.is_parse_call(statement.expression);
	}

	/** Responsibilities: _fallback response field classification_. **/
	private has_response_fields(result: ts.ObjectLiteralExpression): boolean {
		const field_names = new Set<string>();
		for (const property of result.properties) {
			if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
				field_names.add(property.name.text);
			}
		}
		return field_names.has("stdout") && field_names.has("exit_code");
	}

	/** Responsibilities: _catch clause state_. **/
	public constructor(clause: ts.CatchClause) {
		this._clause = clause;
	}

	/** Responsibilities: _JSON parser operation classification_. **/
	public parse_operation(): boolean {
		const parent = this._clause.parent;
		if (!ts.isTryStatement(parent) || parent.tryBlock.statements.length !== 1) {
			return false;
		}
		for (const statement of parent.tryBlock.statements) {
			return this.is_parse_statement(statement);
		}
		return false;
	}

	/** Responsibilities: _failure response classification_. **/
	public failure_result(): boolean {
		const statements = this._clause.block.statements;
		if (statements.length !== 1) {
			return false;
		}
		for (const statement of statements) {
			if (!ts.isReturnStatement(statement)) {
				return false;
			}
			const expression = statement.expression;
			if (expression === undefined || !ts.isObjectLiteralExpression(expression)) {
				return false;
			}
			return this.has_response_fields(expression);
		}
		return false;
	}
}
