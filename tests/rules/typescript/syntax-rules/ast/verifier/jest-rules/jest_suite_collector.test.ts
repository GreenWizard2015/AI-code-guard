import { describe, expect, test } from "@jest/globals";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import { JestSuiteCollector } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_suite_collector";
import ts from "typescript";

describe("Jest suite collection", () => {
	test("keeps nested tests out of their parent suite", () => {
		const source_file = ts.createSourceFile(
			"suite.test.ts",
			"describe('outer', () => { test('first', () => { describe('nested', () => { test('inside', () => {}); }); }); test('second', () => {}); });",
			ts.ScriptTarget.Latest,
			true,
		);
		const declarations = new TypeScriptObjectAliasDeclarationIndex();
		const collector = new JestSuiteCollector(
			new TypeScriptExpressionAliases("describe", declarations),
			new TypeScriptExpressionAliases("test", declarations),
			new TypeScriptExpressionAliases("it", declarations),
		);
		const suites = collector.suites(source_file);

		expect(suites.map((suite) => ({ nested: suite.nested, test_count: suite.tests.length }))).toEqual([
			{ nested: false, test_count: 2 },
			{ nested: true, test_count: 1 },
		]);
	});

	test("resolves suite aliases and data-driven tests", () => {
		const source_file = ts.createSourceFile(
			"aliased-suite.test.ts",
			"const suite = describe; suite.each([[1]])('outer', () => { test.each([[2]])('row', () => {}); });",
			ts.ScriptTarget.Latest,
			true,
		);
		const declarations = new TypeScriptObjectAliasDeclarationIndex();
		const collector = new JestSuiteCollector(
			new TypeScriptExpressionAliases("describe", declarations),
			new TypeScriptExpressionAliases("test", declarations),
			new TypeScriptExpressionAliases("it", declarations),
		);
		const suites = collector.suites(source_file);

		expect(suites.map((suite) => ({ nested: suite.nested, test_count: suite.tests.length }))).toEqual([
			{ nested: false, test_count: 1 },
		]);
	});
});
