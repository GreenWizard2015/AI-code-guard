import ts from "typescript";
import { describe, expect, test } from "@jest/globals";
import { TypeScriptCallableAliases } from "src/linting/test-support/type_script_callable_aliases";
import { TypeScriptObjectCallableAliases } from "src/linting/test-support/type_script_object_callable_aliases";
import { FakeObject } from "src/linting/test-support/fake_object";
import { ObjectCallableAliases } from "src/linting/orchestration/runtime/typescript-rule-groups/object-literal-aliases/object_callable_aliases";
import { ObjectDestructuredAliases } from "src/linting/orchestration/runtime/typescript-rule-groups/object-literal-aliases/object_destructured_aliases";

describe("TypeScript callable alias scope caches", () => {
	test("collects each callable scope once", () => {
		const source_file = ts.createSourceFile(
			"callable-alias-cache.ts",
			"const first = () => {}; const second = first;",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new TypeScriptCallableAliases();
		const first_result = aliases.names(source_file);
		const second_result = aliases.names(source_file);

		expect(second_result).toBe(first_result);
	});

	test("collects each typed object scope once", () => {
		const source_file = ts.createSourceFile(
			"object-alias-cache.ts",
			"interface Contract { run(): void; } const value: Contract = { run() {} };",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new TypeScriptObjectCallableAliases();
		const first_result = aliases.names(source_file);
		const second_result = aliases.names(source_file);

		expect(second_result).toBe(first_result);
	});

	test("collects each callable object alias scope once", () => {
		const source_file = ts.createSourceFile(
			"callable-object-alias-cache.ts",
			"const { run: operation } = { run: () => {} }; const { service: alias } = { service: { run: () => {} } };",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new ObjectCallableAliases(new FakeObject());
		const first_result = aliases.names(source_file);
		const second_result = aliases.names(source_file);

		expect({ same_result: second_result === first_result, includes_alias: first_result.has("operation") }).toEqual({
			same_result: true,
			includes_alias: true,
		});
	});

	test("collects each destructured object alias scope once", () => {
		const source_file = ts.createSourceFile(
			"destructured-object-alias-cache.ts",
			"const { run: operation } = { run: () => {} }; const { service: alias } = { service: { run: () => {} } };",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new ObjectDestructuredAliases(new FakeObject());
		const first_result = aliases.names(source_file);
		const second_result = aliases.names(source_file);

		expect({ same_result: second_result === first_result, includes_alias: first_result.has("alias") }).toEqual({
			same_result: true,
			includes_alias: true,
		});
	});
});
