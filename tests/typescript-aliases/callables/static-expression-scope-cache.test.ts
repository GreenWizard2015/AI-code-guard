import { describe, expect, test } from "@jest/globals";
import ts from "typescript";
import { TypeScriptStaticExpressionOperations } from "src/typescript-aliases/callables/type_script_static_expression_operations";
import { TypeScriptStaticExpressionValues } from "src/typescript-aliases/callables/type_script_static_expression_values";

/** Responsibilities: _scope expression selection_, _traversal observation_. **/
class StaticExpressionScopeScenario {
	private readonly source: ts.SourceFile;
	public scope_visits: number;

	/** Responsibilities: _source ownership_. **/
	public constructor(source: ts.SourceFile) {
		this.source = source;
		this.scope_visits = 0;
	}

	/** Responsibilities: _function traversal observation_. **/
	public observe_function_scope(name: string): void {
		for (const statement of this.source.statements) {
			if (!ts.isFunctionDeclaration(statement)) {
				continue;
			}
			if (statement.name === undefined || statement.name.text !== name) {
				continue;
			}
			const original_for_each_child = statement.forEachChild;
			Object.defineProperty(statement, "forEachChild", {
				value: (callback: (node: ts.Node) => void) => {
					this.scope_visits += 1;
					return original_for_each_child.call(statement, callback);
				},
			});
		}
	}

	/** Responsibilities: _function body expression_. **/
	public return_expression(name: string): ts.Expression {
		for (const statement of this.source.statements) {
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
		for (const statement of this.source.statements) {
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

describe("static expression scope cache", () => {
	test("reuses completed values and binding names for the same scope", () => {
		const source = ts.createSourceFile(
			"scope.ts",
			'const project_key = "project"; function read_value() { const local_key = "local"; return payload[project_key]; }',
			ts.ScriptTarget.Latest,
			true,
		);
		const scenario = new StaticExpressionScopeScenario(source);
		scenario.observe_function_scope("read_value");
		const expression = scenario.return_expression("read_value");
		const values = new TypeScriptStaticExpressionValues(new TypeScriptStaticExpressionOperations());
		const first = values.values(expression);
		const first_scope_visits = scenario.scope_visits;
		const second = values.values(expression);

		expect([
			first.get("local_key"),
			second.get("local_key"),
			first_scope_visits > 0,
			scenario.scope_visits === first_scope_visits,
		]).toEqual(["local", "local", true, true]);
	});

	test("keeps completed results isolated between sibling scopes", () => {
		const source = ts.createSourceFile(
			"sibling-scopes.ts",
			'function first() { const key = "first"; return key; } function second() { const key = "second"; return key; }',
			ts.ScriptTarget.Latest,
			true,
		);
		const scenario = new StaticExpressionScopeScenario(source);
		const values = new TypeScriptStaticExpressionValues(new TypeScriptStaticExpressionOperations());
		expect([scenario.return_value(values, "first"), scenario.return_value(values, "second")]).toEqual([
			"first",
			"second",
		]);
	});
});
