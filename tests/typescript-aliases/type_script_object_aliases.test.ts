import { describe, expect, test } from "@jest/globals";
import ts from "typescript";
import { TypeScriptObjectAliases } from "src/typescript-aliases/type_script_object_aliases";
import { TypeScriptObjectAliasDeclarationIndex } from "src/typescript-aliases/type_script_object_alias_declaration_index";

describe("TypeScript object alias declarations", () => {
	test("preserves declaration order and excludes nested function scopes", () => {
		const source = ts.createSourceFile(
			"object-aliases.ts",
			[
				"const first = {};",
				"first = {};",
				"function nested() { const hidden = {}; hidden = {}; }",
				"const last = {};",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const declaration_index = new TypeScriptObjectAliasDeclarationIndex();
		const declarations = declaration_index.declarations(source);
		const names = declarations.map((node) => {
			if (ts.isVariableDeclaration(node)) {
				return node.name.getText(source);
			}
			return node.getText(source);
		});

		expect(names).toEqual(["first", "first = {}", "last"]);
	});

	test("reuses the declaration index for the same AST scope", () => {
		const source = ts.createSourceFile("alias-cache.ts", "const value = {};", ts.ScriptTarget.Latest, true);
		const declaration_index = new TypeScriptObjectAliasDeclarationIndex();
		const first = declaration_index.declarations(source);
		const second = declaration_index.declarations(source);

		expect(first === second).toBe(true);
	});

	test("shares immutable declaration lists without sharing mutable alias state", () => {
		const first_source = ts.createSourceFile(
			"first-scope.ts",
			"const value = { first: true };",
			ts.ScriptTarget.Latest,
			true,
		);
		const second_source = ts.createSourceFile(
			"second-scope.ts",
			"const value = { second: true };",
			ts.ScriptTarget.Latest,
			true,
		);
		const declaration_index = new TypeScriptObjectAliasDeclarationIndex();
		const first_aliases = new TypeScriptObjectAliases(declaration_index);
		const second_aliases = new TypeScriptObjectAliases(declaration_index);
		first_aliases.collect(first_source);
		second_aliases.collect(second_source);
		const first_value = first_aliases.value(ts.factory.createIdentifier("value"));
		const second_value = second_aliases.value(ts.factory.createIdentifier("value"));

		expect({
			shared_scope_declarations:
				declaration_index.declarations(first_source) === declaration_index.declarations(first_source),
			first_value: first_value.getText(first_source),
			second_value: second_value.getText(second_source),
		}).toEqual({
			shared_scope_declarations: true,
			first_value: "{ first: true }",
			second_value: "{ second: true }",
		});
	});
});
