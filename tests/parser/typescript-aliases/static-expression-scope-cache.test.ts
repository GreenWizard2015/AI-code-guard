import { describe, expect, test } from "@jest/globals";
import { TypeScriptStaticExpressionOperations } from "src/parser/typescript-aliases/type_script_static_expression_operations";
import { TypeScriptStaticExpressionValues } from "src/parser/typescript-aliases/type_script_static_expression_values";
import { StaticExpressionScopeScenario } from "tests/parser/typescript-aliases/static-expression-scope-scenario";
import ts from "typescript";

describe("static expression scope cache", () => {
	test("returns the correct binding value for repeated scope lookups", () => {
		const source = ts.createSourceFile(
			"scope.ts",
			'const project_key = "project"; function read_value() { const local_key = "local"; return payload[project_key]; }',
			ts.ScriptTarget.Latest,
			true,
		);
		const scenario = new StaticExpressionScopeScenario(source);
		const expression = scenario.return_expression("read_value");
		const values = new TypeScriptStaticExpressionValues(new TypeScriptStaticExpressionOperations());
		const first = values.values(expression);
		const second = values.values(expression);

		expect([first.get("local_key"), second.get("local_key")]).toEqual(["local", "local"]);
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
