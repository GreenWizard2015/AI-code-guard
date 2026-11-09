import { describe, expect, test } from "@jest/globals";
import { LintStageTimer } from "src/lint_stage_timer";
import type { ViolationContract } from "src/reporting_protocols";
import { JestBindingIndex } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_binding_index";
import { JestTestRules } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_test_rules";
import { TestModuleResolver } from "tests/rules/typescript/syntax-rules/test-module-resolver";
import ts from "typescript";

describe("AST-detectable implementation hacks", () => {
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
		const rules = new JestTestRules(
			source_file.fileName,
			source_file,
			new JestBindingIndex(source_file),
			new LintStageTimer(),
		);
		rules.append_violations(violations, new TestModuleResolver());

		const type_only_violations = violations.filter(
			(violation) => violation.rule_id() === "typescript-jest-type-only-test",
		);
		expect(type_only_violations).toHaveLength(1);
		expect(type_only_violations.map((violation) => violation.priority())).toEqual([6]);
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
		const rules = new JestTestRules(
			source_file.fileName,
			source_file,
			new JestBindingIndex(source_file),
			new LintStageTimer(),
		);
		rules.append_violations(violations, new TestModuleResolver());

		expect(violations.filter((violation) => violation.rule_id() === "typescript-jest-type-only-test")).toHaveLength(1);
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
		const rules = new JestTestRules(
			source_file.fileName,
			source_file,
			new JestBindingIndex(source_file),
			new LintStageTimer(),
		);
		rules.append_violations(violations, new TestModuleResolver());

		expect(violations.filter((violation) => violation.rule_id() === "test-exception-only")).toHaveLength(1);
		expect(
			violations
				.filter((violation) => violation.rule_id() === "test-exception-only")
				.map((violation) => violation.priority()),
		).toEqual([6]);
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
		const rules = new JestTestRules(
			source_file.fileName,
			source_file,
			new JestBindingIndex(source_file),
			new LintStageTimer(),
		);
		rules.append_violations(violations, new TestModuleResolver());

		expect(violations.filter((violation) => violation.rule_id() === "test-exception-only")).toHaveLength(3);
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
		const rules = new JestTestRules(
			source_file.fileName,
			source_file,
			new JestBindingIndex(source_file),
			new LintStageTimer(),
		);
		rules.append_violations(violations, new TestModuleResolver());

		expect(violations.filter((violation) => violation.rule_id() === "test-exception-only")).toHaveLength(1);
		expect(violations.filter((violation) => violation.rule_id() === "typescript-jest-type-only-test")).toHaveLength(1);
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
		const rules = new JestTestRules(
			source_file.fileName,
			source_file,
			new JestBindingIndex(source_file),
			new LintStageTimer(),
		);
		rules.append_violations(violations, new TestModuleResolver());

		expect(violations.filter((violation) => violation.rule_id() === "test-exception-only")).toHaveLength(0);
	});
});
