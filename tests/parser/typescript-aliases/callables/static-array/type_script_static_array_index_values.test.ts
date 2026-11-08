import assert from "node:assert/strict";
import { describe, expect, test } from "@jest/globals";
import { TypeScriptStaticArrayIndexValues } from "src/parser/typescript-aliases/callables/static-array/type_script_static_array_index_values";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import ts from "typescript";

describe("static array index values", () => {
	test("evaluates nested arithmetic with TypeScript precedence", () => {
		const source = ts.createSourceFile("index.ts", "const index = 2 + 3 * 4;", ts.ScriptTarget.Latest, true);
		const variable_statements = source.statements.filter(ts.isVariableStatement);
		const first_statement = variable_statements[0];
		assert.ok(first_statement);
		const declaration = first_statement.declarationList.declarations[0];
		assert.ok(declaration);
		const expression = declaration.initializer;
		assert.ok(expression);
		const indexes = new TypeScriptStaticArrayIndexValues(new Map(), new TypeScriptObjectAliasDeclarationIndex());
		const value = indexes.numeric_index(expression);

		expect(value).toBe(14);
	});

	test("evaluates bitwise shift operations", () => {
		const source = ts.createSourceFile("index.ts", "const index = (12 >> 1) | 1;", ts.ScriptTarget.Latest, true);
		const variable_statements = source.statements.filter(ts.isVariableStatement);
		const first_statement = variable_statements[0];
		assert.ok(first_statement);
		const declaration = first_statement.declarationList.declarations[0];
		assert.ok(declaration);
		const expression = declaration.initializer;
		assert.ok(expression);
		const indexes = new TypeScriptStaticArrayIndexValues(new Map(), new TypeScriptObjectAliasDeclarationIndex());
		const value = indexes.numeric_index(expression);

		expect(value).toBe(7);
	});
});
