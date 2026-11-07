import { describe, expect, test } from "@jest/globals";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import { TypeScriptObjectAliases } from "src/parser/typescript-aliases/type_script_object_aliases";
import ts from "typescript";

describe("TypeScript object alias declarations", () => {
	test("preserves declaration order and excludes nested function scopes", () => {
		const source = ts.createSourceFile(
			"object-aliases.ts",
			[
				"const first = {};",
				"first = {};",
				"let pending;",
				"pending = {};",
				"first + last;",
				"first === last;",
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

		expect(names).toEqual(["first", "first = {}", "pending = {}", "last"]);
	});

	test("reuses one AST declaration inventory across independent alias consumers", () => {
		const source = ts.createSourceFile("alias-cache.ts", "const value = {};", ts.ScriptTarget.Latest, true);
		const declaration_index = new TypeScriptObjectAliasDeclarationIndex();
		const first_aliases = new TypeScriptObjectAliases(declaration_index);
		const second_aliases = new TypeScriptObjectAliases(declaration_index);
		first_aliases.collect(source);
		second_aliases.collect(source);
		const first = declaration_index.declarations(source);
		const second = declaration_index.declarations(source);

		expect({
			shared_inventory: first === second,
			first_value: first_aliases.value(ts.factory.createIdentifier("value")).getText(source),
			second_value: second_aliases.value(ts.factory.createIdentifier("value")).getText(source),
		}).toEqual({ shared_inventory: true, first_value: "{}", second_value: "{}" });
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
		const first_declarations = declaration_index.declarations(first_source);
		const second_declarations = declaration_index.declarations(second_source);

		expect({
			separate_scope_declarations: first_declarations !== second_declarations,
			first_value: first_value.getText(first_source),
			second_value: second_value.getText(second_source),
		}).toEqual({
			separate_scope_declarations: true,
			first_value: "{ first: true }",
			second_value: "{ second: true }",
		});
	});

	test("collects property values from object literals and spreads", () => {
		const source = ts.createSourceFile(
			"property-values.ts",
			'const base = { key: "base" }; const value = { ...base, key: "own" };',
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new TypeScriptObjectAliases(new TypeScriptObjectAliasDeclarationIndex());
		aliases.collect(source);
		const values = aliases.property_values(ts.factory.createIdentifier("value"), "key");

		expect(values.map((value) => value.getText(source))).toEqual(['"base"', '"own"']);
	});

	test("resolves forward object alias chains without treating other expressions as objects", () => {
		const source = ts.createSourceFile(
			"forward-object-aliases.ts",
			"const first = (second); const second = third; const third = { key: 1 }; const ignored = build();",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new TypeScriptObjectAliases(new TypeScriptObjectAliasDeclarationIndex());
		aliases.collect(source);
		const values = aliases.property_values(ts.factory.createIdentifier("first"), "key");
		const ignored = aliases.value(ts.factory.createIdentifier("ignored"));

		expect({
			values: values.map((value) => value.getText(source)),
			ignored_is_unresolved: ts.isIdentifier(ignored) && ignored.text === "ignored",
		}).toEqual({ values: ["1"], ignored_is_unresolved: true });
	});

	test("resolves forward aliases introduced by assignments", () => {
		const source = ts.createSourceFile(
			"forward-object-assignments.ts",
			"let first; let second; first = second; second = { key: 1 };",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new TypeScriptObjectAliases(new TypeScriptObjectAliasDeclarationIndex());
		aliases.collect(source);
		const values = aliases.property_values(ts.factory.createIdentifier("first"), "key");

		expect(values.map((value) => value.getText(source))).toEqual(["1"]);
	});
});
