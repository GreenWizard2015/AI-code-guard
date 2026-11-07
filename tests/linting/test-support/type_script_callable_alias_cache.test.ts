import { describe, expect, test } from "@jest/globals";
import { ExternalImportedTypes } from "src/linting/test-support/external_imported_types";
import { FakeObject } from "src/linting/test-support/fake_object";
import { TypeScriptCallableAliases } from "src/linting/test-support/type_script_callable_aliases";
import { TypeScriptObjectCallableAliases } from "src/linting/test-support/type_script_object_callable_aliases";
import { ObjectCallableAliases } from "src/rules/typescript/syntax-rules/ast/verifier/object-returns/object_callable_aliases";
import { ObjectDestructuredAliases } from "src/rules/typescript/syntax-rules/ast/verifier/object-returns/object_destructured_aliases";
import ts from "typescript";

describe("TypeScript callable alias scope caches", () => {
	test("treats every src import as project-owned regardless of directory name", () => {
		const source_file = ts.createSourceFile(
			"external-source-import.ts",
			'import { ProjectType } from "src/external/project-type"; import { VendorType } from "vendor/types";',
			ts.ScriptTarget.Latest,
			true,
		);
		const external_types = new ExternalImportedTypes();

		expect({
			project_import: external_types.imports_external_name(source_file, "ProjectType"),
			vendor_import: external_types.imports_external_name(source_file, "VendorType"),
		}).toEqual({ project_import: false, vendor_import: true });
	});

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

	test("collects callable alias chains and destructured array aliases", () => {
		const source_file = ts.createSourceFile(
			"callable-aliases.ts",
			"function original() {} const first = () => {}; const second = first; const [execute] = [second];",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new TypeScriptCallableAliases();

		expect({
			original: aliases.contains(ts.factory.createIdentifier("original"), source_file),
			first: aliases.contains(ts.factory.createIdentifier("first"), source_file),
			second: aliases.contains(ts.factory.createIdentifier("second"), source_file),
			execute: aliases.contains(ts.factory.createIdentifier("execute"), source_file),
			unknown: aliases.contains(ts.factory.createIdentifier("unknown"), source_file),
		}).toEqual({ original: true, first: true, second: true, execute: true, unknown: false });
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

	test("collects destructured methods from a typed instance", () => {
		const source_file = ts.createSourceFile(
			"typed-object-alias.ts",
			"class Service { run() {} } const { run: execute } = new Service(); execute();",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new TypeScriptObjectCallableAliases();
		const result = aliases.names(source_file);

		expect(result.has("execute")).toBe(true);
	});

	test("collects each callable object alias scope once", () => {
		const source_file = ts.createSourceFile(
			"callable-object-alias-cache.ts",
			"const { run: operation } = { run: () => {} }; const { service: alias } = { service: { run: () => {} } };",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new ObjectCallableAliases(new FakeObject(new ExternalImportedTypes()));
		const first_result = aliases.names(source_file);
		const second_result = aliases.names(source_file);

		expect({ same_result: second_result === first_result, includes_alias: first_result.has("operation") }).toEqual({
			same_result: true,
			includes_alias: true,
		});
	});

	test("keeps callable binding aliases isolated by lexical scope", () => {
		const source_file = ts.createSourceFile(
			"callable-object-scopes.ts",
			"function first() { const { run: first_run } = { run: () => {} }; } function second() { const { run: second_run } = { run: () => {} }; }",
			ts.ScriptTarget.Latest,
			true,
		);
		const scopes = source_file.statements.filter(ts.isFunctionDeclaration);
		const first_scope = scopes.at(0);
		const second_scope = scopes.at(1);
		const aliases = new ObjectCallableAliases(new FakeObject(new ExternalImportedTypes()));
		const first_aliases = new Set<string>();
		const second_aliases = new Set<string>();
		if (first_scope !== undefined) {
			for (const name of aliases.names(first_scope)) {
				first_aliases.add(name);
			}
		}
		if (second_scope !== undefined) {
			for (const name of aliases.names(second_scope)) {
				second_aliases.add(name);
			}
		}

		expect({
			scope_count: scopes.length,
			first_scope: [first_aliases.has("first_run"), first_aliases.has("second_run")],
			second_scope: [second_aliases.has("first_run"), second_aliases.has("second_run")],
		}).toEqual({
			scope_count: 2,
			first_scope: [true, false],
			second_scope: [false, true],
		});
	});

	test("collects each destructured object alias scope once", () => {
		const source_file = ts.createSourceFile(
			"destructured-object-alias-cache.ts",
			"const { run: operation } = { run: () => {} }; const { service: alias } = { service: { run: () => {} } };",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new ObjectDestructuredAliases(new FakeObject(new ExternalImportedTypes()));
		const first_result = aliases.names(source_file);
		const second_result = aliases.names(source_file);

		expect({ same_result: second_result === first_result, includes_alias: first_result.has("alias") }).toEqual({
			same_result: true,
			includes_alias: true,
		});
	});
});
