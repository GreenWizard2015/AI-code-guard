import type { TypeScriptStaticExpressionValues } from "src/parser/typescript-aliases/type_script_static_expression_values";
import ts from "typescript";

/** Responsibilities: _scope expression selection_, _traversal observation_. **/
export class StaticExpressionScopeScenario {
	private readonly _source: ts.SourceFile;

	/** Responsibilities: _source ownership_. **/
	public constructor(source: ts.SourceFile) {
		this._source = source;
	}

	/** Responsibilities: _function body expression_. **/
	public return_expression(name: string): ts.Expression {
		for (const statement of this._source.statements) {
			if (!ts.isFunctionDeclaration(statement)) {
				continue;
			}
			if (statement.name === undefined || statement.name.text !== name || statement.body === undefined) {
				continue;
			}
			for (const child of statement.body.statements) {
				if (ts.isReturnStatement(child) && child.expression !== undefined) {
					return child.expression;
				}
			}
		}
		return ts.factory.createIdentifier("missing");
	}

	/** Responsibilities: _static function value_. **/
	public return_value(values: TypeScriptStaticExpressionValues, name: string): string {
		for (const statement of this._source.statements) {
			if (!ts.isFunctionDeclaration(statement)) {
				continue;
			}
			if (statement.name === undefined || statement.name.text !== name || statement.body === undefined) {
				continue;
			}
			for (const child of statement.body.statements) {
				if (ts.isReturnStatement(child) && child.expression !== undefined) {
					return values.value(child.expression, child);
				}
			}
		}
		return "";
	}
}
