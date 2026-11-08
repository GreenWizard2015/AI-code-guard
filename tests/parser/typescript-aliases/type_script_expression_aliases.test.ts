import assert from "node:assert/strict";
import { describe, expect, test } from "@jest/globals";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import ts from "typescript";

describe("TypeScript expression aliases", () => {
	test("normalizes transparent wrappers consistently across target aliases", () => {
		const source_file = ts.createSourceFile(
			"expression-aliases.ts",
			"((target as object)!);",
			ts.ScriptTarget.Latest,
			true,
		);
		let expression: ts.Expression = ts.factory.createIdentifier("missing");
		for (const statement of source_file.statements) {
			if (ts.isExpressionStatement(statement)) {
				expression = statement.expression;
			}
		}
		const declaration_index = new TypeScriptObjectAliasDeclarationIndex();
		const reflect_aliases = new TypeScriptExpressionAliases("Reflect", declaration_index);
		const proxy_aliases = new TypeScriptExpressionAliases("Proxy", declaration_index);
		const reflect_expression = reflect_aliases.unwrapped(expression);
		const proxy_expression = proxy_aliases.unwrapped(expression);

		expect({
			reflect: reflect_expression.getText(),
			proxy: proxy_expression.getText(),
			cached: declaration_index.cached_normal_form(expression).getText(),
		}).toEqual({
			reflect: "target",
			proxy: "target",
			cached: "target",
		});
	});

	test("resolves aliases that point to the target", () => {
		const source_file = ts.createSourceFile(
			"expression-aliases.ts",
			"const first = this; const second = first; second;",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new TypeScriptExpressionAliases("this", new TypeScriptObjectAliasDeclarationIndex());
		const statement = source_file.statements.find(ts.isExpressionStatement);
		let access: ts.Expression | undefined;
		if (statement !== undefined) {
			access = statement.expression;
		}
		let resolution = "missing-expression";
		if (access !== undefined) {
			if (aliases.receiver({ expression: access, node: source_file })) {
				resolution = "target";
			} else {
				resolution = "other";
			}
		}

		expect(resolution).toBe("target");
	});

	test("does not resolve unrelated identifiers as target aliases", () => {
		const source_file = ts.createSourceFile(
			"expression-aliases.ts",
			"const first = other; first;",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new TypeScriptExpressionAliases("this", new TypeScriptObjectAliasDeclarationIndex());
		const statement = source_file.statements.find(ts.isExpressionStatement);
		let access: ts.Expression | undefined;
		if (statement !== undefined) {
			access = statement.expression;
		}
		let resolution = "missing-expression";
		if (access !== undefined) {
			if (aliases.receiver({ expression: access, node: source_file })) {
				resolution = "target";
			} else {
				resolution = "other";
			}
		}

		expect(resolution).toBe("other");
	});

	test("resolves nested member paths through transparent wrappers", () => {
		const source_file = ts.createSourceFile(
			"nested-expression-aliases.ts",
			"((Reflect as object)).construct; Reflect['construct']; Object.construct;",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new TypeScriptExpressionAliases("Reflect.construct", new TypeScriptObjectAliasDeclarationIndex());
		const expressions = source_file.statements
			.filter(ts.isExpressionStatement)
			.map((statement) => statement.expression);
		const resolved = expressions.map((expression) => aliases.receiver({ expression, node: source_file }));

		expect(resolved).toEqual([true, true, false]);
	});

	test("shares declaration inventories without sharing target aliases", () => {
		const source_file = ts.createSourceFile(
			"shared-expression-aliases.ts",
			"const reflect_alias = Reflect; const object_alias = Object;",
			ts.ScriptTarget.Latest,
			true,
		);
		const declaration_index = new TypeScriptObjectAliasDeclarationIndex();
		const reflect_aliases = new TypeScriptExpressionAliases("Reflect", declaration_index);
		const object_aliases = new TypeScriptExpressionAliases("Object", declaration_index);
		expect({
			reflect_alias: reflect_aliases.receiver({
				expression: ts.factory.createIdentifier("reflect_alias"),
				node: source_file,
			}),
			object_alias: object_aliases.receiver({
				expression: ts.factory.createIdentifier("object_alias"),
				node: source_file,
			}),
			reflect_rejects_object: reflect_aliases.receiver({
				expression: ts.factory.createIdentifier("object_alias"),
				node: source_file,
			}),
			object_rejects_reflect: object_aliases.receiver({
				expression: ts.factory.createIdentifier("reflect_alias"),
				node: source_file,
			}),
		}).toEqual({
			reflect_alias: true,
			object_alias: true,
			reflect_rejects_object: false,
			object_rejects_reflect: false,
		});
	});

	test("returns the cached normalized expression on repeated access", () => {
		const source_file = ts.createSourceFile(
			"expression-aliases.ts",
			"((target as object)!);",
			ts.ScriptTarget.Latest,
			true,
		);
		const statement = source_file.statements.find(ts.isExpressionStatement);
		assert.ok(statement);
		const aliases = new TypeScriptExpressionAliases("target", new TypeScriptObjectAliasDeclarationIndex());
		const first = aliases.unwrapped(statement.expression);
		const second = aliases.unwrapped(statement.expression);

		expect(first).toBe(second);
	});

	test("removes nested transparent wrappers", () => {
		const source_file = ts.createSourceFile(
			"expression-aliases.ts",
			"((target as object)!);",
			ts.ScriptTarget.Latest,
			true,
		);
		const statement = source_file.statements.find(ts.isExpressionStatement);
		assert.ok(statement);
		const aliases = new TypeScriptExpressionAliases("target", new TypeScriptObjectAliasDeclarationIndex());

		expect(aliases.unwrapped(statement.expression).getText(source_file)).toBe("target");
	});

	test("unwraps every transparent expression form and nested wrappers", () => {
		const source_file = ts.createSourceFile(
			"expression-aliases.ts",
			[
				"const parenthesized = (target);",
				"const non_null = target!;",
				"const asserted = target as string;",
				"const type_asserted = <string>target;",
				"const satisfied = target satisfies string;",
				"const awaited = await target;",
				"const nested = ((target as string)! satisfies string);",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const names = new TypeScriptExpressionNames();
		const actual: string[] = [];
		for (const statement of source_file.statements) {
			if (!ts.isVariableStatement(statement)) {
				continue;
			}
			const declaration = statement.declarationList.declarations[0];
			assert.ok(declaration);
			const expression = declaration.initializer;
			assert.ok(expression);
			actual.push(names.unwrap_transparent_expression(expression).getText(source_file));
		}

		expect(actual).toEqual(Array.from({ length: 7 }, () => "target"));
	});
});
