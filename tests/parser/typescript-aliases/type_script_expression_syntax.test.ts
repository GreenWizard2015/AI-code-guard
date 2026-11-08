import assert from "node:assert/strict";
import { describe, expect, test } from "@jest/globals";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import ts from "typescript";

describe("TypeScript expression syntax cache", () => {
	test("resolves property and element member names", () => {
		const source_file = ts.createSourceFile("syntax.ts", "target.member;", ts.ScriptTarget.Latest, true);
		const expression_statement = source_file.statements.at(0);
		const aliases = new TypeScriptExpressionAliases("target", new TypeScriptObjectAliasDeclarationIndex());
		let property_name = "";
		if (expression_statement !== undefined && ts.isExpressionStatement(expression_statement)) {
			property_name = aliases.member_name({ expression: expression_statement.expression });
		}
		const element_source = ts.createSourceFile("syntax.ts", 'target["member"];', ts.ScriptTarget.Latest, true);
		const element_statement = element_source.statements.at(0);
		let element_name = "";
		if (element_statement !== undefined && ts.isExpressionStatement(element_statement)) {
			element_name = aliases.member_name({ expression: element_statement.expression });
		}

		expect({ property_name, element_name }).toEqual({ property_name: "member", element_name: "member" });
	});

	test("does not treat a constant identifier key as a static member name", () => {
		const source_file = ts.createSourceFile(
			"syntax.ts",
			"const key = 'member'; target[key];",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new TypeScriptExpressionAliases("target", new TypeScriptObjectAliasDeclarationIndex());
		const statements = source_file.statements.filter(ts.isExpressionStatement);
		const dynamic_statement = statements[0];
		assert.ok(dynamic_statement);

		expect(aliases.member_name({ expression: dynamic_statement.expression })).toBe("");
	});

	test("resolves a string literal element key as a static member name", () => {
		const source_file = ts.createSourceFile("syntax.ts", "target['member'];", ts.ScriptTarget.Latest, true);
		const aliases = new TypeScriptExpressionAliases("target", new TypeScriptObjectAliasDeclarationIndex());
		const statement = source_file.statements[0];
		assert.ok(statement);
		assert.ok(ts.isExpressionStatement(statement));

		expect(aliases.member_name({ expression: statement.expression })).toBe("member");
	});
});
