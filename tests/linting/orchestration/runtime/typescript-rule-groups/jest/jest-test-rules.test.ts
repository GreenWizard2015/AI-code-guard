import { describe, expect, test } from "@jest/globals";
import ts from "typescript";
import { JestTestRules } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_test_rules";
import type { ViolationContract } from "src/protocols";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import { ResolvedTypeScriptDeclarationKind } from "src/module-resolution/types";
import type { ResolvedTypeScriptExport } from "src/module-resolution/types";

/** Responsibilities: _module symbol resolution_, _declaration kind provision_. **/
class TestModuleResolver implements TypeScriptModuleResolverContract {
	/** Responsibilities: _module path resolution_. **/
	public module_symbol(_file: string, module_name: string): string {
		return module_name;
	}

	/** Responsibilities: _export resolution_. **/
	public resolve(_file: string, name: string): ResolvedTypeScriptExport {
		return { file: "", name };
	}

	/** Responsibilities: _symbol kind identification_. **/
	public symbol_kind(): ResolvedTypeScriptDeclarationKind {
		return ResolvedTypeScriptDeclarationKind.Other;
	}
}

describe("AST-detectable implementation hacks", () => {
	test("applies callable size limits to individual Jest tests", () => {
		const test_source_lines = [
			"describe('test size', () => {",
			"  test('large test', () => {",
			Array.from({ length: 20 }, (_, index) => `    const value_${index} = ${index};`).join("\n"),
			"  });",
			"  test('small test', () => {});",
			"  test('one assertion', () => { expect(true).toBe(true); });",
			"  test('expression callback', () => expect(true).toBe(true));",
			"  test('minimum boundary', () => { const value = true; expect(value).toBe(true); });",
			"  test('maximum boundary', () => {",
			Array.from({ length: 13 }, (_, index) => `    const boundary_${index} = ${index};`).join("\n"),
			"    expect(boundary_12).toBe(12);",
			"  });",
			"});",
		];
		const test_source = test_source_lines.join("\n");
		const source_file = ts.createSourceFile(
			"tests/jest-test-size.test.ts",
			test_source,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const violations: ViolationContract[] = [];
		const rules = new JestTestRules();
		rules.append_violations(violations, source_file.fileName, source_file, new TestModuleResolver());

		expect(violations.filter((violation) => violation.rule_id === "test-max-size")).toHaveLength(1);
		expect(violations.filter((violation) => violation.rule_id === "test-min-size")).toHaveLength(3);
	});

	test("requires one flat top-level Jest describe", () => {
		const source_file = ts.createSourceFile(
			"tests/jest-structure.test.ts",
			[
				"describe('outer', () => {",
				"  describe('nested', () => { test('nested test', () => {}); });",
				"});",
				"describe('second', () => { test('second test', () => {}); });",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const violations: ViolationContract[] = [];
		const rules = new JestTestRules();
		rules.append_violations(violations, source_file.fileName, source_file, new TestModuleResolver());

		expect(violations.map((violation) => violation.rule_id)).toEqual(
			expect.arrayContaining(["typescript-jest-describe-count", "typescript-jest-nested-describe"]),
		);
	});

	test("requires Jest tests to end with expect", () => {
		const source_file = ts.createSourceFile(
			"tests/jest-test-ending.test.ts",
			[
				"describe('test ending', () => {",
				"  test('bad order', () => {",
				"    expect(true).toBe(true);",
				"    const trailing_value = true;",
				"    expect(trailing_value).toBe(true);",
				"  });",
				"  test('good order', () => {",
				"    const value = true;",
				"    expect(value).toBe(true);",
				"  });",
				"});",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const violations: ViolationContract[] = [];
		const rules = new JestTestRules();
		rules.append_violations(violations, source_file.fileName, source_file, new TestModuleResolver());

		expect(violations.filter((violation) => violation.rule_id === "typescript-jest-test-ending")).toHaveLength(1);
	});

	test("requires Jest tests to use arrow callbacks and contain expect", () => {
		const source_file = ts.createSourceFile(
			"tests/jest-test-shape.test.ts",
			[
				"describe('test shape', () => {",
				"  test('function callback', function named_callback() { expect(true).toBe(true); });",
				"  test('missing assertion', () => { const value = true; void value; });",
				"});",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const violations: ViolationContract[] = [];
		const rules = new JestTestRules();
		rules.append_violations(violations, source_file.fileName, source_file, new TestModuleResolver());

		expect({
			lambda: violations.filter((violation) => violation.rule_id === "typescript-jest-test-lambda").length,
			expect: violations.filter((violation) => violation.rule_id === "typescript-jest-test-expect").length,
		}).toEqual({ lambda: 1, expect: 1 });
	});

	test("rejects Jest tests that only check runtime types", () => {
		const source_file = ts.createSourceFile(
			"tests/type-only.test.ts",
			[
				"describe('type-only tests', () => {",
				"  test('only checks construction', () => {",
				"    const resolver = new ProfileResolver();",
				"    (expect(resolver)).toBeInstanceOf(ProfileResolver);",
				"  });",
				"  test('checks behavior', () => {",
				"    const resolver = new ProfileResolver();",
				"    const result = resolver.resolve();",
				"    expect(resolver).toBeInstanceOf(ProfileResolver);",
				'    expect(result).toBe("resolved");',
				"  });",
				"});",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const violations: ViolationContract[] = [];
		const rules = new JestTestRules();
		rules.append_violations(violations, source_file.fileName, source_file, new TestModuleResolver());

		const type_only_violations = violations.filter(
			(violation) => violation.rule_id === "typescript-jest-type-only-test",
		);
		expect(type_only_violations).toHaveLength(1);
		expect(type_only_violations[0]?.priority).toBe(6);
	});

	test("rejects Jest tests that only check fields and methods", () => {
		const source_file = ts.createSourceFile(
			"tests/shape-only.test.ts",
			[
				"describe('shape-only tests', () => {",
				"  test('only checks methods and fields', () => {",
				"    const resolver = new ProfileResolver();",
				'    expect(resolver).toHaveProperty("resolve");',
				"    expect(resolver).toEqual(expect.objectContaining({ cache: expect.any(Map) }));",
				"  });",
				"  test('checks behavior', () => {",
				'    expect(new ProfileResolver().resolve()).toBe("resolved");',
				"  });",
				"});",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const violations: ViolationContract[] = [];
		const rules = new JestTestRules();
		rules.append_violations(violations, source_file.fileName, source_file, new TestModuleResolver());

		expect(violations.filter((violation) => violation.rule_id === "typescript-jest-type-only-test")).toHaveLength(1);
	});

	test("rejects Jest tests that only check exceptions", () => {
		const source_file = ts.createSourceFile(
			"tests/exception-only.test.ts",
			[
				"describe('exception-only tests', () => {",
				"  test('only checks the handler exception', async () => {",
				"    await expect(request_handler.handle(invalid_request)).rejects.toThrow();",
				"  });",
				"  test('checks the server response', async () => {",
				"    const response = await server.handle(invalid_request);",
				"    expect(response.status).toBe(400);",
				"  });",
				"});",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const violations: ViolationContract[] = [];
		const rules = new JestTestRules();
		rules.append_violations(violations, source_file.fileName, source_file, new TestModuleResolver());

		expect(violations.filter((violation) => violation.rule_id === "test-exception-only")).toHaveLength(1);
		expect(violations.find((violation) => violation.rule_id === "test-exception-only")?.priority).toBe(6);
	});

	test("rejects Jest exception-only bypass patterns", () => {
		const source_file = ts.createSourceFile(
			"tests/exception-bypass.test.ts",
			[
				"describe('exception bypasses', () => {",
				"  test('manual catch', () => {",
				"    try { request_handler.handle(invalid_request); } catch { return; }",
				"  });",
				"  test('error type', () => {",
				"    try { request_handler.handle(invalid_request); } catch (error) {",
				"      expect(error instanceof Error).toBe(true);",
				"    }",
				"  });",
				"  test('raised flag', () => {",
				"    let raised = false;",
				"    try { request_handler.handle(invalid_request); } catch { raised = true; }",
				"    expect(raised).toBe(true);",
				"  });",
				"  test('checks persistent state after a failed publication', () => {",
				"    try { publication.replace(invalid_document); } catch { }",
				"    expect(publication.read()).toEqual(previous_document);",
				"  });",
				"});",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const violations: ViolationContract[] = [];
		const rules = new JestTestRules();
		rules.append_violations(violations, source_file.fileName, source_file, new TestModuleResolver());

		expect(violations.filter((violation) => violation.rule_id === "test-exception-only")).toHaveLength(3);
	});

	test("classifies literal bracket matcher access like dot access", () => {
		const source_file = ts.createSourceFile(
			"tests/jest-bracket-matchers.test.ts",
			[
				"describe('static matcher access', () => {",
				"  test('exception matcher', () => {",
				"    expect(() => service.run())['toThrow']();",
				"  });",
				"  test('type matcher', () => {",
				"    expect(service)['toBeInstanceOf'](Service);",
				"  });",
				"  test('dynamic matcher is not classified by its runtime value', () => {",
				"    const matcher = get_matcher_name();",
				"    expect(() => service.run())[matcher]();",
				"  });",
				"});",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const violations: ViolationContract[] = [];
		const rules = new JestTestRules();
		rules.append_violations(violations, source_file.fileName, source_file, new TestModuleResolver());

		expect(violations.filter((violation) => violation.rule_id === "test-exception-only")).toHaveLength(1);
		expect(violations.filter((violation) => violation.rule_id === "typescript-jest-type-only-test")).toHaveLength(1);
	});

	test("keeps shadowed catch flags separate from production result bindings", () => {
		const source_file = ts.createSourceFile(
			"tests/jest-exception-flag-binding.test.ts",
			[
				"describe('exception flag binding', () => {",
				"  test('asserts the production result', () => {",
				"    { let result = false; try { service.probe(); } catch { result = true; } }",
				"    const result = service.is_ready();",
				"    expect(result).toBe(true);",
				"  });",
				"});",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const violations: ViolationContract[] = [];
		const rules = new JestTestRules();
		rules.append_violations(violations, source_file.fileName, source_file, new TestModuleResolver());

		expect(violations.filter((violation) => violation.rule_id === "test-exception-only")).toHaveLength(0);
	});
});
