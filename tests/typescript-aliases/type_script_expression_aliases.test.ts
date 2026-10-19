import ts from "typescript";
import { describe, expect, test } from "@jest/globals";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";

describe("TypeScript expression aliases", () => {
	test("resolves aliases that point to the target", () => {
		const source_file = ts.createSourceFile(
			"expression-aliases.ts",
			"const first = this; const second = first; second;",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new TypeScriptExpressionAliases("this");
		const expressions = source_file.statements.filter(ts.isExpressionStatement);
		const expression_statement = expressions[0];
		const access = expression_statement.expression;

		expect(aliases.receiver(access, source_file)).toBe(true);
	});

	test("does not resolve unrelated identifiers as target aliases", () => {
		const source_file = ts.createSourceFile(
			"expression-aliases.ts",
			"const first = other; first;",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new TypeScriptExpressionAliases("this");
		const expressions = source_file.statements.filter(ts.isExpressionStatement);
		const expression_statement = expressions[0];
		const access = expression_statement.expression;

		expect(aliases.receiver(access, source_file)).toBe(false);
	});
});
